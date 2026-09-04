"use server";

import type { CrateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { createCrateReturnSchema } from "@/lib/validators/crate-return";
import { nextDocumentNumber } from "@/lib/numbering";

/**
 * Creates a per-trip aggregate CrateReturn record.
 *
 * SCHEMA LIMITATION (documented per build brief): `CrateReturn` only carries
 * aggregate counts (cratesDispatched/Returned/Damaged/Missing) — there is no
 * FK from a CrateReturn row to the individual Crate rows involved, and
 * TripItem carries a crate *count* only (no Crate FK either), so a trip's
 * dispatched crates cannot be traced back to specific physical crates from
 * the schema alone. To still let a real crate-status change happen where
 * possible, this action accepts an optional, NOT persisted-as-is
 * `crateOutcomes` array of `{crateId, outcome}` pairs (sourced from crates
 * currently assigned to the trip's customer): when supplied, those specific
 * `Crate` rows are updated to the matching status and the aggregate counts
 * are DERIVED from it (overriding the manually typed totals). When omitted,
 * only the aggregate counts are recorded and no individual Crate row is
 * touched — a fully best-effort, aggregate-only fallback, per plan decision 5
 * ("Crate history is Crate.status + AuditLog, not a separate movement table").
 */
export async function createCrateReturnAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CRATE_CREATE");
    const data = createCrateReturnSchema.parse(input);

    const trip = await prisma.trip.findUnique({ where: { id: data.tripId } });
    if (!trip) return { ok: false, error: "Trip not found." };

    const returnedIds = data.crateOutcomes.filter((o) => o.outcome === "RETURNED").map((o) => o.crateId);
    const damagedIds = data.crateOutcomes.filter((o) => o.outcome === "DAMAGED").map((o) => o.crateId);
    const missingIds = data.crateOutcomes.filter((o) => o.outcome === "MISSING").map((o) => o.crateId);
    const usingPerCrate = data.crateOutcomes.length > 0;

    const cratesReturned = usingPerCrate ? returnedIds.length : data.cratesReturned;
    const cratesDamaged = usingPerCrate ? damagedIds.length : data.cratesDamaged;
    const cratesMissing = usingPerCrate ? missingIds.length : data.cratesMissing;

    const result = await prisma.$transaction(async (tx) => {
      const returnNumber = await nextDocumentNumber(tx, "CRATE_RETURN");
      const crateReturn = await tx.crateReturn.create({
        data: {
          returnNumber,
          tripId: trip.id,
          customerId: trip.customerId,
          vehicleId: trip.vehicleId,
          driverId: trip.driverId,
          cratesDispatched: data.cratesDispatched,
          cratesReturned,
          cratesDamaged,
          cratesMissing,
          returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
          condition: data.condition,
          remarks: data.remarks,
        },
      });

      // Returned crates go through cleaning before they're AVAILABLE again and
      // are no longer with this customer; damaged/missing crates keep their
      // last known customer association for follow-up/recovery purposes.
      const statusUpdates: { id: string; status: CrateStatus }[] = [
        ...returnedIds.map((id) => ({ id, status: "CLEANING" as CrateStatus })),
        ...damagedIds.map((id) => ({ id, status: "DAMAGED" as CrateStatus })),
        ...missingIds.map((id) => ({ id, status: "MISSING" as CrateStatus })),
      ];

      const applied: { id: string; status: CrateStatus }[] = [];
      for (const u of statusUpdates) {
        const existing = await tx.crate.findUnique({ where: { id: u.id } });
        if (!existing) continue; // best-effort — silently skip crate ids that no longer resolve
        await tx.crate.update({
          where: { id: u.id },
          data: { status: u.status, customerId: u.status === "CLEANING" ? null : existing.customerId },
        });
        applied.push(u);
      }

      return { crateReturn, applied };
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "CrateReturn",
      entityId: result.crateReturn.id,
      newValues: {
        returnNumber: result.crateReturn.returnNumber,
        tripId: trip.id,
        cratesDispatched: data.cratesDispatched,
        cratesReturned,
        cratesDamaged,
        cratesMissing,
        perCrateTracked: usingPerCrate,
      },
    });

    for (const u of result.applied) {
      await writeAuditLog({
        userId: user.id,
        action: "EDIT",
        entityType: "Crate",
        entityId: u.id,
        newValues: { status: u.status, reason: `Crate return ${result.crateReturn.returnNumber}` },
      });
    }

    revalidatePath("/crates/returns");
    revalidatePath("/crates");
    revalidatePath(`/dispatch/trips/${trip.id}`);
    return { ok: true, data: { id: result.crateReturn.id } };
  } catch (error) {
    return actionError(error);
  }
}
