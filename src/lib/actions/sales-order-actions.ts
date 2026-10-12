"use server";

import { Prisma, SalesOrderStatus } from "@prisma/client";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { assertSeparateApprover } from "@/lib/services/approval-policy";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/validators/common";
import { actionError, paginationSchema, paginationMeta } from "@/lib/validators/common";
import { salesOrderSchema } from "@/lib/validators/sales-order";
import { nextDocumentNumber } from "@/lib/numbering";
import { notifyRoleByName } from "@/lib/services/notifications";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function computeLineTotal(quantity: number, rate: number) {
  return round2(quantity * rate);
}

export type SalesOrderRow = {
  id: string;
  soNumber: string;
  customerName: string;
  orderDate: string;
  deliveryDate: string | null;
  priority: string | null;
  totalAmount: number;
  status: string;
};

const salesOrderListQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  // Unknown status values / unparseable dates are ignored rather than passed to Prisma (which would throw).
  status: z
    .string()
    .optional()
    .transform((v) =>
      v && (Object.values(SalesOrderStatus) as string[]).includes(v) ? (v as SalesOrderStatus) : undefined,
    ),
  customerId: z.string().optional(),
  dateFrom: z
    .string()
    .optional()
    .transform((v) => (v && !Number.isNaN(new Date(v).getTime()) ? v : undefined)),
  dateTo: z
    .string()
    .optional()
    .transform((v) => (v && !Number.isNaN(new Date(v).getTime()) ? v : undefined)),
});

/**
 * Paginated Sales Order list with status/customer/date-range filters and
 * free-text search over SO number and customer name.
 */
export async function listSalesOrdersAction(
  input: unknown,
): Promise<ActionResult<{ rows: SalesOrderRow[]; pagination: ReturnType<typeof paginationMeta> }>> {
  try {
    await requirePermission("SALES_ORDER_VIEW");
    const query = salesOrderListQuerySchema.parse(input);

    const where: Prisma.SalesOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            orderDate: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { soNumber: { contains: query.q, mode: "insensitive" } },
              { customer: { name: { contains: query.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.salesOrder.count({ where }),
      prisma.salesOrder.findMany({
        where,
        orderBy: { orderDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          soNumber: true,
          orderDate: true,
          deliveryDate: true,
          priority: true,
          totalAmount: true,
          status: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    return {
      ok: true,
      data: {
        rows: orders.map((so) => ({
          id: so.id,
          soNumber: so.soNumber,
          customerName: so.customer.name,
          orderDate: format(so.orderDate, "dd MMM yyyy"),
          deliveryDate: so.deliveryDate ? format(so.deliveryDate, "dd MMM yyyy") : null,
          priority: so.priority,
          totalAmount: Number(so.totalAmount),
          status: so.status,
        })),
        pagination: paginationMeta(total, query),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Returns the current grade-wise stock balance for an item at a warehouse, so
 * the Sales Order form can show a live "Available" column per line as the
 * user picks item/grade/warehouse. SalesOrder/SalesOrderItem carry no
 * warehouseId (see schema-gap note in the module report) — the warehouse
 * passed here is a form-only concept used purely for this stock preview, not
 * persisted anywhere.
 */
/** Grade-wise stock for an item summed across all warehouses — trips can draw on any of them. */
export async function getSalesOrderItemStockAction(
  itemId: string,
): Promise<ActionResult<{ grade: string; quantity: number }[]>> {
  try {
    await requirePermission("SALES_ORDER_VIEW");
    if (!itemId) return { ok: true, data: [] };
    const totals = await prisma.itemGradeStock.groupBy({
      by: ["grade"],
      where: { itemId },
      _sum: { quantity: true },
    });
    return { ok: true, data: totals.map((t) => ({ grade: t.grade, quantity: Number(t._sum.quantity ?? 0) })) };
  } catch (error) {
    return actionError(error);
  }
}

export async function createSalesOrderAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SALES_ORDER_CREATE");
    const data = salesOrderSchema.parse(input);

    const lines = data.items.map((line) => ({
      itemId: line.itemId,
      grade: line.grade,
      quantity: line.quantity,
      rate: line.rate,
      total: computeLineTotal(line.quantity, line.rate),
    }));
    const totalAmount = round2(lines.reduce((sum, l) => sum + l.total, 0));

    const created = await prisma.$transaction(async (tx) => {
      const soNumber = await nextDocumentNumber(tx, "SALES_ORDER");
      return tx.salesOrder.create({
        data: {
          soNumber,
          customerId: data.customerId,
          orderDate: new Date(data.orderDate),
          deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
          priority: data.priority || null,
          remarks: data.remarks || null,
          totalAmount,
          status: "DRAFT",
          createdById: user.id,
          items: {
            create: lines.map((line) => ({
              itemId: line.itemId,
              grade: line.grade,
              quantity: line.quantity,
              rate: line.rate,
              total: line.total,
              fulfilledQty: 0,
            })),
          },
        },
      });
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "SalesOrder",
      entityId: created.id,
      newValues: { soNumber: created.soNumber, totalAmount, lineCount: lines.length },
    });

    revalidatePath("/sales/orders");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitSalesOrderAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SALES_ORDER_EDIT");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id } });

    if (so.status !== "DRAFT") {
      return { ok: false, error: "Only draft sales orders can be submitted for approval." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.salesOrder.update({ where: { id }, data: { status: "PENDING" } });
      await tx.approval.create({
        data: {
          entityType: "SalesOrder",
          entityId: id,
          requestedById: user.id,
          salesOrderFk: id,
        },
      });
    });

    await notifyRoleByName("Store Manager", {
      type: "PENDING_APPROVAL",
      title: "Sales order pending approval",
      message: `${so.soNumber} is awaiting approval.`,
      entityType: "SalesOrder",
      entityId: id,
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "SalesOrder",
      entityId: id,
      oldValues: { status: "DRAFT" },
      newValues: { status: "PENDING" },
    });

    revalidatePath("/sales/orders");
    revalidatePath(`/sales/orders/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

async function decideSalesOrderApproval(
  id: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SALES_ORDER_APPROVE");

    const updated = await prisma.$transaction(async (tx) => {
      const so = await tx.salesOrder.findUniqueOrThrow({
        where: { id },
        include: { approvals: { where: { decision: "PENDING" }, orderBy: { requestedAt: "desc" } } },
      });

      if (so.status !== "PENDING") {
        throw new Error("This sales order is not pending approval.");
      }

      const approval = so.approvals[0];
      if (!approval) {
        throw new Error("No pending approval record was found for this sales order.");
      }
      if (decision === "APPROVED") {
        await assertSeparateApprover(tx, user.id, [so.createdById, approval.requestedById]);
      }

      await tx.approval.update({
        where: { id: approval.id },
        data: {
          decision,
          decidedById: user.id,
          decidedAt: new Date(),
          comment: comment || null,
        },
      });

      // Approval moves the order straight to READY_FOR_DISPATCH: this module has
      // no separate warehouse-picking step between approval and dispatch, and
      // the dashboard KPI (src/lib/services/dashboard.ts) plus the SO status
      // filter already expect READY_FOR_DISPATCH to be a reachable state.
      const nextStatus = decision === "APPROVED" ? "READY_FOR_DISPATCH" : "DRAFT";
      return tx.salesOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          approvedById: decision === "APPROVED" ? user.id : null,
        },
      });
    });

    if (decision === "APPROVED") {
      await notifyRoleByName("Vehicle Manager", {
        type: "DISPATCH_PENDING",
        title: "Sales order ready for dispatch",
        message: `${updated.soNumber} is approved and ready to be assigned to a trip.`,
        entityType: "SalesOrder",
        entityId: id,
      });
    }

    await writeAuditLog({
      userId: user.id,
      action: decision === "APPROVED" ? "APPROVE" : "REJECT",
      entityType: "SalesOrder",
      entityId: id,
      newValues: { decision, comment },
    });

    revalidatePath("/sales/orders");
    revalidatePath(`/sales/orders/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveSalesOrderAction(id: string, comment?: string): Promise<ActionResult<{ id: string }>> {
  return decideSalesOrderApproval(id, "APPROVED", comment);
}

export async function rejectSalesOrderAction(id: string, comment?: string): Promise<ActionResult<{ id: string }>> {
  return decideSalesOrderApproval(id, "REJECTED", comment);
}

export async function cancelSalesOrderAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("SALES_ORDER_EDIT");
    const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: true } });

    // Approval moves an SO straight to READY_FOR_DISPATCH, so that must stay cancellable
    // until a trip has been raised against it.
    if (!["DRAFT", "PENDING", "APPROVED", "READY_FOR_DISPATCH"].includes(so.status)) {
      return { ok: false, error: `A sales order in ${so.status} status cannot be cancelled.` };
    }

    const activeTrips = await prisma.trip.findMany({
      where: { salesOrderId: id, status: { not: "CANCELLED" } },
      select: { tripNumber: true },
    });
    if (activeTrips.length > 0) {
      return {
        ok: false,
        error: `Trip(s) ${activeTrips.map((t) => t.tripNumber).join(", ")} reference this sales order. Cancel them first.`,
      };
    }

    const anyFulfilled = so.items.some((item) => Number(item.fulfilledQty) > 0);
    if (anyFulfilled) {
      return {
        ok: false,
        error: "This sales order already has fulfilled quantity against it and cannot be cancelled.",
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // ApprovalDecision has no CANCELLED value, so a pending approval is closed
      // as REJECTED with an explanatory comment rather than left PENDING forever.
      await tx.approval.updateMany({
        where: { salesOrderFk: id, decision: "PENDING" },
        data: {
          decision: "REJECTED",
          decidedById: user.id,
          decidedAt: new Date(),
          comment: "Closed automatically: sales order was cancelled.",
        },
      });
      return tx.salesOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    });

    await writeAuditLog({
      userId: user.id,
      action: "VOID",
      entityType: "SalesOrder",
      entityId: id,
      oldValues: { status: so.status },
      newValues: { status: "CANCELLED" },
    });

    revalidatePath("/sales/orders");
    revalidatePath(`/sales/orders/${id}`);
    revalidatePath("/settings/approvals");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
