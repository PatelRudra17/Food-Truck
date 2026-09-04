"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/validators/common";
import { actionError, paginationSchema, paginationMeta } from "@/lib/validators/common";
import { customerSchema } from "@/lib/validators/customer";

function toNullable(value: string | undefined) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Auto-generates the next sequential `CUST-###` code. Master data only — not high-volume enough to need `nextDocumentNumber`/`NumberSequence`. */
async function generateCustomerCode(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.customer.count();
  return `CUST-${String(count + 1).padStart(3, "0")}`;
}

export type CustomerRow = {
  id: string;
  customerCode: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  location: string | null;
  gstNumber: string | null;
  status: "ACTIVE" | "INACTIVE";
};

const customerListQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function listCustomersAction(
  input: unknown,
): Promise<ActionResult<{ rows: CustomerRow[]; pagination: ReturnType<typeof paginationMeta> }>> {
  try {
    await requirePermission("CUSTOMER_VIEW");
    const query = customerListQuerySchema.parse(input);

    const where: Prisma.CustomerWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { customerCode: { contains: query.q, mode: "insensitive" } },
              { phone: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          customerCode: true,
          name: true,
          contactPerson: true,
          phone: true,
          location: true,
          gstNumber: true,
          status: true,
        },
      }),
    ]);

    return {
      ok: true,
      data: { rows: customers, pagination: paginationMeta(total, query) },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function createCustomerAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CUSTOMER_CREATE");
    const data = customerSchema.parse(input);

    const created = await prisma.$transaction(async (tx) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5; attempt++) {
        const customerCode = await generateCustomerCode(tx);
        try {
          return await tx.customer.create({
            data: {
              customerCode,
              name: data.name.trim(),
              contactPerson: toNullable(data.contactPerson),
              phone: toNullable(data.phone),
              email: toNullable(data.email),
              address: toNullable(data.address),
              location: toNullable(data.location),
              gstNumber: toNullable(data.gstNumber),
              status: data.status,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            lastError = error;
            continue;
          }
          throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Failed to generate a unique customer code.");
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Customer",
      entityId: created.id,
      newValues: { ...data, customerCode: created.customerCode },
    });

    revalidatePath("/customers");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A customer with this code already exists. Please try again." };
    }
    return actionError(error);
  }
}

export async function updateCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CUSTOMER_EDIT");
    const data = customerSchema.parse(input);
    const existing = await prisma.customer.findUniqueOrThrow({ where: { id } });

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name.trim(),
        contactPerson: toNullable(data.contactPerson),
        phone: toNullable(data.phone),
        email: toNullable(data.email),
        address: toNullable(data.address),
        location: toNullable(data.location),
        gstNumber: toNullable(data.gstNumber),
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Customer",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveCustomerAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CUSTOMER_ARCHIVE");
    const existing = await prisma.customer.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.customer.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Customer",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateCustomerAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CUSTOMER_EDIT");
    const existing = await prisma.customer.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.customer.update({ where: { id }, data: { status: "ACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Customer",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "ACTIVE" },
    });

    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
