import type { VehicleDocType } from "@prisma/client";

/** Vehicle column that mirrors each document type's expiry. OTHER has none. */
export const VEHICLE_EXPIRY_FIELD = {
  REGISTRATION: "registrationExpiry",
  INSURANCE: "insuranceExpiry",
  PUC: "pucExpiry",
  FITNESS: "fitnessExpiry",
  PERMIT: "permitExpiry",
} as const satisfies Partial<Record<VehicleDocType, string>>;

export type VehicleExpiryField = (typeof VEHICLE_EXPIRY_FIELD)[keyof typeof VEHICLE_EXPIRY_FIELD];

/**
 * When a vehicle document (registration/insurance/PUC/fitness/permit) is saved
 * with an expiry date, the vehicle's own expiry column for that type is moved
 * forward to it — but only if the column is empty or holds an earlier date.
 * A renewed document therefore extends the vehicle's expiry, while saving an
 * older document never shortens it. Returns the Prisma update to apply, or
 * null when nothing should change.
 */
export function vehicleExpiryUpdateForDocument(
  docType: VehicleDocType | string,
  documentExpiry: Date | null,
  vehicle: Partial<Record<VehicleExpiryField, Date | null>>,
): Partial<Record<VehicleExpiryField, Date>> | null {
  if (!documentExpiry || Number.isNaN(documentExpiry.getTime())) return null;
  const field = (VEHICLE_EXPIRY_FIELD as Record<string, VehicleExpiryField | undefined>)[docType];
  if (!field) return null;

  const current = vehicle[field] ?? null;
  if (current && current.getTime() >= documentExpiry.getTime()) return null;
  return { [field]: documentExpiry };
}
