import type { Vehicle, Driver, Prisma, PrismaClient, Grade } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkDispatchEligibility } from "@/lib/services/dispatch";

type Tx = Prisma.TransactionClient | PrismaClient;

export type TripEligibilityItem = {
  itemId: string;
  itemName: string;
  grade: Grade;
  quantity: number;
};

export type TripEligibilityResult = {
  allowed: boolean;
  reasons: string[];
  /** Reasons coming from the vehicle/driver checks — gated by OVERRIDE_MAINTENANCE_BLOCK. */
  vehicleDriverReasons: string[];
  /** Reasons coming from the grade-stock check — gated by OVERRIDE_NEGATIVE_STOCK. */
  stockReasons: string[];
};

/**
 * Single entry point for Trip-creation eligibility. Combines three checks so
 * the Trip-creation action only ever needs to call this one function:
 *
 *   1. Vehicle checks — delegated verbatim to `checkDispatchEligibility()` in
 *      `src/lib/services/dispatch.ts` (read-only reference; not modified here).
 *   2. Driver checks — driver.status === "ACTIVE", plus a DRIVING_LICENCE
 *      DriverDocument that is VERIFIED and not expired.
 *   3. Stock checks — for every item/grade on the trip, confirms the
 *      requested quantity is available across all warehouses.
 *
 * Reasons are split into `vehicleDriverReasons` and `stockReasons` so the
 * caller can decide separately whether OVERRIDE_MAINTENANCE_BLOCK and/or
 * OVERRIDE_NEGATIVE_STOCK cover the specific failures found, per the special
 * permission codes registered in `src/lib/auth/permissions.ts`.
 */
export async function checkTripEligibility(
  params: {
    vehicle: Vehicle;
    driver: Driver;
    items: TripEligibilityItem[];
  },
  tx: Tx = prisma,
): Promise<TripEligibilityResult> {
  const vehicleDriverReasons: string[] = [];

  const vehicleCheck = checkDispatchEligibility(params.vehicle);
  vehicleDriverReasons.push(...vehicleCheck.reasons);

  if (params.driver.status !== "ACTIVE") {
    vehicleDriverReasons.push(`Driver ${params.driver.fullName} is not active (status: ${params.driver.status}).`);
  }

  const licence = await tx.driverDocument.findFirst({
    where: { driverId: params.driver.id, docType: "DRIVING_LICENCE" },
    orderBy: { createdAt: "desc" },
  });

  if (!licence) {
    vehicleDriverReasons.push(`Driver ${params.driver.fullName} has no driving licence on file.`);
  } else {
    if (licence.verificationStatus !== "VERIFIED") {
      vehicleDriverReasons.push(`Driver ${params.driver.fullName}'s driving licence is not verified.`);
    }
    if (!licence.expiryDate || licence.expiryDate < new Date()) {
      vehicleDriverReasons.push(`Driver ${params.driver.fullName}'s driving licence has expired.`);
    }
  }

  // Trips carry no warehouse: graded produce may sit in any warehouse, so a trip can
  // draw on the item's total for that grade (dispatch takes it home-warehouse first).
  // Lines for the same item and grade are added together before checking.
  const requested = new Map<string, { item: TripEligibilityItem; quantity: number }>();
  for (const item of params.items) {
    const key = `${item.itemId}:${item.grade}`;
    const entry = requested.get(key) ?? { item, quantity: 0 };
    entry.quantity += item.quantity;
    requested.set(key, entry);
  }
  const stockReasons: string[] = [];
  for (const { item, quantity } of requested.values()) {
    const total = await tx.itemGradeStock.aggregate({
      where: { itemId: item.itemId, grade: item.grade },
      _sum: { quantity: true },
    });
    const available = Number(total._sum.quantity ?? 0);
    if (available < quantity) {
      stockReasons.push(
        `Insufficient ${item.grade.replace("_", " ")} stock for ${item.itemName}: available ${available}, requested ${quantity}.`,
      );
    }
  }

  const reasons = [...vehicleDriverReasons, ...stockReasons];
  return { allowed: reasons.length === 0, reasons, vehicleDriverReasons, stockReasons };
}
