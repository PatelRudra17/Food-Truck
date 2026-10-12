import "server-only";
import { prisma } from "@/lib/prisma";
import { paginationMeta, type Pagination } from "@/lib/validators/common";
import type { Prisma } from "@prisma/client";

/** Every relation an `Approval` row can carry — exactly one of these is
 * populated per row, matching the seven FK slots on the `Approval` model. */
const approvalInclude = {
  requestedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  outward: {
    select: {
      id: true,
      outwardNumber: true,
      destination: true,
      warehouse: { select: { name: true } },
    },
  },
  adjustment: {
    select: {
      id: true,
      adjustmentNumber: true,
      difference: true,
      item: { select: { name: true } },
      warehouse: { select: { name: true } },
    },
  },
  po: {
    select: {
      id: true,
      poNumber: true,
      totalAmount: true,
      supplier: { select: { companyName: true } },
    },
  },
  transfer: {
    select: {
      id: true,
      transferNumber: true,
      sourceWarehouse: { select: { name: true } },
      destWarehouse: { select: { name: true } },
    },
  },
  inward: {
    select: {
      id: true,
      inwardNumber: true,
      supplier: { select: { companyName: true } },
      warehouse: { select: { name: true } },
    },
  },
  salesOrder: {
    select: {
      id: true,
      soNumber: true,
      totalAmount: true,
      customer: { select: { name: true } },
    },
  },
  wastage: {
    select: {
      id: true,
      wastageNumber: true,
      quantity: true,
      item: { select: { name: true } },
    },
  },
} satisfies Prisma.ApprovalInclude;

type ApprovalRow = Prisma.ApprovalGetPayload<{ include: typeof approvalInclude }>;

/** The seven entity kinds an `Approval` row can point at, keyed to the
 * relation field name populated on that row. */
export type ApprovalEntityKind =
  | "outward"
  | "adjustment"
  | "po"
  | "transfer"
  | "inward"
  | "salesOrder"
  | "wastage";

export type ApprovalDescription = {
  kind: ApprovalEntityKind;
  /** The underlying document's own id (e.g. the StockOutward id) — this is
   * what every existing approve/reject action expects, NOT the Approval
   * row's id. Empty string when no linked record was found. */
  entityId: string;
  /** Human label for the module, e.g. "Stock Outward". */
  moduleLabel: string;
  /** The document number / identifying label, e.g. "OUT-2026-000123". */
  label: string;
  /** Link to the real record so a user can drill in. */
  href: string;
  /** One-line human summary (destination, amount, item, etc). */
  summary: string;
  /** Whether an approve/reject action actually exists for this entity type. */
  actionable: boolean;
};

/** Switches on which of the seven FKs is populated on an `Approval` row and
 * returns a render-ready description. Exactly one of the relations should be
 * non-null; if none are (a malformed row), falls back to the generic
 * entityType/entityId fields. */
export function describeApproval(row: ApprovalRow): ApprovalDescription {
  if (row.outward) {
    return {
      kind: "outward",
      entityId: row.outward.id,
      moduleLabel: "Stock Outward",
      label: row.outward.outwardNumber,
      href: `/stock/outward/${row.outward.id}`,
      summary: `${row.outward.warehouse.name}${row.outward.destination ? ` → ${row.outward.destination}` : ""}`,
      actionable: true,
    };
  }
  if (row.adjustment) {
    const diff = Number(row.adjustment.difference);
    return {
      kind: "adjustment",
      entityId: row.adjustment.id,
      moduleLabel: "Stock Adjustment",
      label: row.adjustment.adjustmentNumber,
      href: `/stock/adjustment/${row.adjustment.id}`,
      summary: `${row.adjustment.item.name} at ${row.adjustment.warehouse.name} (${diff >= 0 ? "+" : ""}${diff.toLocaleString()})`,
      actionable: true,
    };
  }
  if (row.po) {
    return {
      kind: "po",
      entityId: row.po.id,
      moduleLabel: "Purchase Order",
      label: row.po.poNumber,
      href: `/purchase-orders/${row.po.id}`,
      summary: `${row.po.supplier.companyName} — ₹${Number(row.po.totalAmount).toLocaleString()}`,
      actionable: true,
    };
  }
  if (row.transfer) {
    return {
      kind: "transfer",
      entityId: row.transfer.id,
      moduleLabel: "Stock Transfer",
      label: row.transfer.transferNumber,
      href: `/stock/transfer/${row.transfer.id}`,
      summary: `${row.transfer.sourceWarehouse.name} → ${row.transfer.destWarehouse.name}`,
      actionable: true,
    };
  }
  if (row.inward) {
    return {
      kind: "inward",
      entityId: row.inward.id,
      moduleLabel: "Stock Inward",
      label: row.inward.inwardNumber,
      href: `/stock/inward/${row.inward.id}`,
      summary: `${row.inward.supplier?.companyName ?? "No supplier"} at ${row.inward.warehouse.name}`,
      actionable: true,
    };
  }
  if (row.salesOrder) {
    return {
      kind: "salesOrder",
      entityId: row.salesOrder.id,
      moduleLabel: "Sales Order",
      label: row.salesOrder.soNumber,
      href: `/sales/orders/${row.salesOrder.id}`,
      summary: `${row.salesOrder.customer.name} — ₹${Number(row.salesOrder.totalAmount).toLocaleString()}`,
      actionable: true,
    };
  }
  if (row.wastage) {
    return {
      kind: "wastage",
      entityId: row.wastage.id,
      moduleLabel: "Wastage",
      label: row.wastage.wastageNumber,
      href: `/wastage`,
      summary: `${row.wastage.item.name} — ${Number(row.wastage.quantity).toLocaleString()}`,
      actionable: true,
    };
  }
  return {
    kind: "wastage",
    entityId: "",
    moduleLabel: row.entityType,
    label: row.entityId,
    href: "#",
    summary: "No linked record found.",
    actionable: false,
  };
}

export type PendingApproval = {
  id: string;
  requestedByName: string;
  requestedAt: Date;
  comment: string | null;
} & ApprovalDescription;

/** Live aggregate of every PENDING approval across all seven workflows, for
 * the Approval Center's "Pending Approvals" section. Pass `entityTypes` to
 * limit it to the workflows the viewer may decide. */
export async function getPendingApprovals(entityTypes?: readonly string[]): Promise<PendingApproval[]> {
  const rows = await prisma.approval.findMany({
    where: { decision: "PENDING", ...(entityTypes ? { entityType: { in: [...entityTypes] } } : {}) },
    include: approvalInclude,
    orderBy: { requestedAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    requestedByName: row.requestedBy.name,
    requestedAt: row.requestedAt,
    comment: row.comment,
    ...describeApproval(row),
  }));
}

export type ApprovalHistoryFilters = Pagination & {
  decision?: "PENDING" | "APPROVED" | "REJECTED";
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  /** When set, only approvals of these entity types are returned. */
  allowedEntityTypes?: readonly string[];
};

export type ApprovalHistoryRow = {
  id: string;
  decision: string;
  requestedByName: string;
  requestedAt: Date;
  decidedByName: string | null;
  decidedAt: Date | null;
  comment: string | null;
} & ApprovalDescription;

/** Paginated, filterable list of ALL approvals (any decision) for an
 * audit-style history view. */
export async function getApprovalHistory(
  filters: ApprovalHistoryFilters,
): Promise<{ rows: ApprovalHistoryRow[]; meta: ReturnType<typeof paginationMeta> }> {
  const { page, pageSize, decision, entityType, dateFrom, dateTo, allowedEntityTypes } = filters;

  const where: Prisma.ApprovalWhereInput = {
    ...(decision ? { decision } : {}),
    ...(entityType ? { entityType } : {}),
    ...(allowedEntityTypes ? { AND: [{ entityType: { in: [...allowedEntityTypes] } }] } : {}),
    ...(dateFrom || dateTo
      ? {
          requestedAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.approval.count({ where }),
    prisma.approval.findMany({
      where,
      include: approvalInclude,
      orderBy: { requestedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      decision: row.decision,
      requestedByName: row.requestedBy.name,
      requestedAt: row.requestedAt,
      decidedByName: row.decidedBy?.name ?? null,
      decidedAt: row.decidedAt,
      comment: row.comment,
      ...describeApproval(row),
    })),
    meta: paginationMeta(total, { page, pageSize }),
  };
}

/** Distinct entityType values seen on Approval rows, for the history filter
 * dropdown. */
export async function getApprovalEntityTypes(allowedEntityTypes?: readonly string[]): Promise<string[]> {
  const rows = await prisma.approval.findMany({
    where: allowedEntityTypes ? { entityType: { in: [...allowedEntityTypes] } } : undefined,
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}
