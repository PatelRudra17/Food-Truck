import type { Vehicle, Driver, Prisma, PrismaClient, Grade } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkDispatchEligibility } from "@/lib/services/dispatch";
import { getItemGradeStock } from "@/lib/services/produce-inventory";

type Tx = Prisma.TransactionClient | PrismaClient;

export type TripEligibilityItem = {
  itemId: string;
  itemName: string;
  warehouseId: string;
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
 *   3. Stock checks — for every TripItem about to be created, confirms the
 *      requested quantity of that grade is available via
 *      `getItemGradeStock()` from `src/lib/services/produce-inventory.ts`.
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

  const stockReasons: string[] = [];
  for (const item of params.items) {
    const balances = await getItemGradeStock(item.itemId, item.warehouseId, tx);
    const available = balances.find((b) => b.grade === item.grade)?.quantity ?? 0;
    if (available < item.quantity) {
      stockReasons.push(
        `Insufficient ${item.grade.replace("_", " ")} stock for ${item.itemName}: available ${available}, requested ${item.quantity}.`,
      );
    }
  }

  const reasons = [...vehicleDriverReasons, ...stockReasons];
  return { allowed: reasons.length === 0, reasons, vehicleDriverReasons, stockReasons };
}
