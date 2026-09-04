"use server";

import { Prisma, type CrateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { crateSchema, crateStatusChangeSchema } from "@/lib/validators/crate";

/** Auto-generates the next sequential `CRT-####` crate code. Master data only —
 * not high-volume enough to need `nextDocumentNumber`/`NumberSequence`, but padded
 * to 4 digits since a warehouse can hold thousands of physical crates. */
async function generateCrateCode(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.crate.count();
  return `CRT-${String(count + 1).padStart(4, "0")}`;
}

export async function createCrateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CRATE_CREATE");
    const data = crateSchema.parse(input);

    if (data.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new Error("Selected customer does not exist.");
    }

    const created = await prisma.$transaction(async (tx) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5; attempt++) {
        const crateCode = await generateCrateCode(tx);
        try {
          return await tx.crate.create({
            data: {
              crateCode,
              crateType: data.crateType,
              capacity: data.capacity,
              currentLocation: data.currentLocation,
              customerId: data.customerId,
              condition: data.condition,
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
      throw lastError instanceof Error ? lastError : new Error("Failed to generate a unique crate code.");
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Crate",
      entityId: created.id,
      newValues: { ...data, crateCode: created.crateCode },
    });

    revalidatePath("/crates");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A crate with this code already exists. Please try again." };
    }
    return actionError(error);
  }
}

export async function updateCrateAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CRATE_EDIT");
    const data = crateSchema.parse(input);
    const existing = await prisma.crate.findUniqueOrThrow({ where: { id } });

    if (data.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new Error("Selected customer does not exist.");
    }

    const updated = await prisma.crate.update({
      where: { id },
      data: {
        crateType: data.crateType,
        capacity: data.capacity,
        currentLocation: data.currentLocation,
        customerId: data.customerId,
        condition: data.condition,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Crate",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/crates");
    revalidatePath(`/crates/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

/** Dedicated status-transition action. Always requires a reason (validated by
 * crateStatusChangeSchema) — this is the only path allowed to change `status`,
 * matching the schema's design intent that Crate.status + AuditLog together
 * ARE the crate's movement history (there is no separate movement table). */
export async function changeCrateStatusAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CRATE_EDIT");
    const data = crateStatusChangeSchema.parse(input);
    const existing = await prisma.crate.findUniqueOrThrow({ where: { id } });

    if (existing.status === data.status) {
      throw new Error(`Crate is already ${data.status.replaceAll("_", " ").toLowerCase()}.`);
    }

    const updated = await prisma.crate.update({
      where: { id },
      data: { status: data.status as CrateStatus },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Crate",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: data.status, reason: data.reason },
    });

    revalidatePath("/crates");
    revalidatePath(`/crates/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
