"use server";

import { Prisma, type CrateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { crateSchema, crateStatusChangeSchema, markCratesCleanedSchema } from "@/lib/validators/crate";

/** Auto-generates the next sequential `CRT-####` crate code. Master data only —
 * not high-volume enough to need `nextDocumentNumber`/`NumberSequence`, but padded
 * to 4 digits since a warehouse can hold thousands of physical crates. */
async function generateCrateCode(tx: Prisma.TransactionClient): Promise<string> {
  // Highest existing numeric suffix (not a row count), so gaps can't produce a duplicate.
  const [row] = await tx.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(CAST(SUBSTRING("crateCode" FROM 5) AS INTEGER)) AS max
    FROM "Crate"
    WHERE "crateCode" ~ '^CRT-[0-9]{1,9}$'`;
  return `CRT-${String((row?.max ?? 0) + 1).padStart(4, "0")}`;
}

/** Concurrent creates can still race to the same code. A unique-constraint failure aborts the
 * whole Postgres transaction, so each retry must run in a fresh transaction. */
const MAX_CODE_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createCrateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CRATE_CREATE");
    const data = crateSchema.parse(input);

    if (data.customerId) {
      const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new Error("Selected customer does not exist.");
    }

    let created: Prisma.CrateGetPayload<object> | undefined;
    for (let attempt = 1; !created; attempt++) {
      try {
        created = await prisma.$transaction(async (tx) => {
          const crateCode = await generateCrateCode(tx);
          return tx.crate.create({
            data: {
              crateCode,
              crateType: data.crateType,
              capacity: data.capacity,
              currentLocation: data.currentLocation,
              customerId: data.customerId,
              condition: data.condition,
            },
          });
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_CODE_ATTEMPTS) continue;
        throw error;
      }
    }

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

/** Returned crates land in CLEANING; this moves them back to AVAILABLE (the
 * Cleaning module was removed). Only crates still in CLEANING are touched, and
 * each one gets its own audit entry since AuditLog is the crate movement history. */
export async function markCratesCleanedAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requirePermission("CRATE_EDIT");
    const data = markCratesCleanedSchema.parse(input ?? {});

    const crates = await prisma.$transaction(async (tx) => {
      const targets = await tx.crate.findMany({
        where: { status: "CLEANING", ...(data.ids ? { id: { in: data.ids } } : {}) },
        select: { id: true },
      });
      if (targets.length === 0) throw new Error("No crates are waiting for cleaning.");
      await tx.crate.updateMany({
        where: { id: { in: targets.map((c) => c.id) }, status: "CLEANING" },
        data: { status: "AVAILABLE" },
      });
      return targets;
    });

    for (const crate of crates) {
      await writeAuditLog({
        userId: user.id,
        action: "EDIT",
        entityType: "Crate",
        entityId: crate.id,
        oldValues: { status: "CLEANING" },
        newValues: { status: "AVAILABLE", reason: "Cleaned" },
      });
    }

    revalidatePath("/crates");
    revalidatePath("/crates/[id]", "page");
    return { ok: true, data: { count: crates.length } };
  } catch (error) {
    return actionError(error);
  }
}
