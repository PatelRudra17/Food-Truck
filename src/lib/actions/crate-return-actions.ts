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
 * the counts are applied to the crates the trip took out at dispatch (see
 * below); for older trips without that record only the aggregate counts are
 * stored — a best-effort, aggregate-only fallback, per plan decision 5
 * ("Crate history is Crate.status + AuditLog, not a separate movement table").
 */
export async function createCrateReturnAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CRATE_CREATE");
    const data = createCrateReturnSchema.parse(input);

    const trip = await prisma.trip.findUnique({
      where: { id: data.tripId },
      include: { items: { select: { cratesCount: true } } },
    });
    if (!trip) return { ok: false, error: "Trip not found." };
    if (!["DISPATCHED", "DELIVERED", "RETURNED"].includes(trip.status)) {
      return { ok: false, error: "Crate returns can only be recorded for a trip that has been dispatched." };
    }

    let returnedIds = data.crateOutcomes.filter((o) => o.outcome === "RETURNED").map((o) => o.crateId);
    let damagedIds = data.crateOutcomes.filter((o) => o.outcome === "DAMAGED").map((o) => o.crateId);
    let missingIds = data.crateOutcomes.filter((o) => o.outcome === "MISSING").map((o) => o.crateId);
    const usingPerCrate = data.crateOutcomes.length > 0;

    const cratesReturned = usingPerCrate ? returnedIds.length : data.cratesReturned;
    const cratesDamaged = usingPerCrate ? damagedIds.length : data.cratesDamaged;
    const cratesMissing = usingPerCrate ? missingIds.length : data.cratesMissing;

    // Count-only return: apply the counts to the physical crates this trip took out
    // (recorded on its DISPATCHED audit entry) that are still with the customer, so
    // they don't stay "With customer" forever. Older trips without that record keep
    // the aggregate-only behaviour.
    if (!usingPerCrate && cratesReturned + cratesDamaged + cratesMissing > 0) {
      const dispatchLog = await prisma.auditLog.findFirst({
        where: { entityType: "Trip", entityId: trip.id, action: "EDIT", newValues: { path: ["status"], equals: "DISPATCHED" } },
        orderBy: { createdAt: "desc" },
        select: { newValues: true },
      });
      const codes = (dispatchLog?.newValues as { crates?: unknown } | null)?.crates;
      if (Array.isArray(codes) && codes.length > 0) {
        const outstanding = await prisma.crate.findMany({
          where: { crateCode: { in: codes as string[] }, customerId: trip.customerId, status: "WITH_CUSTOMER" },
          orderBy: { crateCode: "asc" },
          select: { id: true },
        });
        const ids = outstanding.map((c) => c.id);
        returnedIds = ids.slice(0, cratesReturned);
        damagedIds = ids.slice(cratesReturned, cratesReturned + cratesDamaged);
        missingIds = ids.slice(cratesReturned + cratesDamaged, cratesReturned + cratesDamaged + cratesMissing);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Returns are cumulative per trip: across every return recorded for it,
      // returned + damaged + missing may never exceed the crates that went out.
      // The trip's own TripItem.cratesCount total is authoritative; only when the
      // trip recorded no crate counts does the first return's typed figure stand.
      const previous = await tx.crateReturn.findMany({
        where: { tripId: trip.id },
        orderBy: { createdAt: "asc" },
        select: { cratesDispatched: true, cratesReturned: true, cratesDamaged: true, cratesMissing: true },
      });
      const tripCrates = trip.items.reduce((sum, line) => sum + (line.cratesCount ?? 0), 0);
      const cratesDispatched = tripCrates > 0 ? tripCrates : (previous[0]?.cratesDispatched ?? data.cratesDispatched);
      const alreadyAccounted = previous.reduce(
        (sum, r) => sum + r.cratesReturned + r.cratesDamaged + r.cratesMissing,
        0,
      );
      const outstanding = Math.max(0, cratesDispatched - alreadyAccounted);
      const accountedNow = cratesReturned + cratesDamaged + cratesMissing;
      if (accountedNow > outstanding) {
        throw new Error(
          `This trip dispatched ${cratesDispatched} crates and ${alreadyAccounted} are already accounted for; only ${outstanding} can still be returned, damaged or missing.`,
        );
      }

      // Per-crate outcomes may only touch crates currently out with this trip's customer.
      const outcomeIds = data.crateOutcomes.map((o) => o.crateId);
      if (outcomeIds.length > 0) {
        const eligible = await tx.crate.count({
          where: { id: { in: outcomeIds }, customerId: trip.customerId, status: { in: ["WITH_CUSTOMER", "LOADED"] } },
        });
        if (eligible !== new Set(outcomeIds).size) {
          throw new Error("One or more selected crates are not currently with this trip's customer.");
        }
      }

      const returnNumber = await nextDocumentNumber(tx, "CRATE_RETURN");
      const crateReturn = await tx.crateReturn.create({
        data: {
          returnNumber,
          tripId: trip.id,
          customerId: trip.customerId,
          vehicleId: trip.vehicleId,
          driverId: trip.driverId,
          cratesDispatched,
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
          data:
            u.status === "CLEANING"
              ? { status: u.status, customerId: null, currentLocation: null }
              : { status: u.status, customerId: existing.customerId },
        });
        applied.push(u);
      }

      return { crateReturn, applied, cratesDispatched };
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "CrateReturn",
      entityId: result.crateReturn.id,
      newValues: {
        returnNumber: result.crateReturn.returnNumber,
        tripId: trip.id,
        cratesDispatched: result.cratesDispatched,
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
