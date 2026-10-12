import { z } from "zod";

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "INSIDE",
  "OUTSIDE",
  "ON_TRIP",
  "MAINTENANCE",
  "INACTIVE",
] as const;

export const VEHICLE_DOC_TYPES = ["REGISTRATION", "INSURANCE", "PUC", "FITNESS", "PERMIT", "OTHER"] as const;

export const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/** Uppercases and drops spaces/dashes so "mh 12-ab 1234" and "MH12AB1234" are the same plate. */
export function normalizeVehicleNumber(value: string): string {
  return value.replace(/[\s-]+/g, "").toUpperCase();
}

/**
 * Optional positive number typed into a form input (always a string there).
 * Blank means "not set".
 */
function optionalPositiveNumber(message: string, { integer = false } = {}) {
  // Accepts the raw input string from the form *and* the number it becomes after the
  // client-side parse, because server actions re-validate the already-parsed values.
  return z
    .union([z.number(), z.string().trim()])
    .nullish()
    .transform((v) => (v === "" || v == null ? undefined : Number(v)))
    .refine((v) => v === undefined || (Number.isFinite(v) && v > 0 && (!integer || Number.isInteger(v))), {
      message,
    });
}

/**
 * Excludes fuelType/odometerKm/fuelCostPerKmTarget/lastService fields/maintenanceState/
 * maintenanceOverride — those are driven by the Fuel/Maintenance modules. The
 * fuel-efficiency target and service schedule are set here because nothing else
 * can set them, and anomaly detection / service reminders depend on them.
 */
export const vehicleSchema = z.object({
  vehicleNumber: z
    .string()
    .transform(normalizeVehicleNumber)
    .pipe(z.string().min(2, "Vehicle number is required").max(20)),
  vehicleType: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Vehicle type is required")),
  manufacturer: optionalText,
  model: optionalText,
  ownerCompany: optionalText,
  registrationDate: optionalDate,
  registrationExpiry: optionalDate,
  insuranceExpiry: optionalDate,
  pucExpiry: optionalDate,
  fitnessExpiry: optionalDate,
  permitExpiry: optionalDate,
  capacity: optionalText,
  currentDriverId: optionalText,
  currentLocation: optionalText,
  status: z.enum(VEHICLE_STATUSES),
  imageUrl: optionalText,
  fuelEfficiencyTargetKmpl: optionalPositiveNumber("Must be a number greater than zero."),
  serviceIntervalDays: optionalPositiveNumber("Must be a whole number of days greater than zero.", { integer: true }),
  serviceIntervalKm: optionalPositiveNumber("Must be a number greater than zero."),
  nextServiceDate: optionalDate,
  nextServiceKm: optionalPositiveNumber("Must be a number greater than zero."),
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const vehicleDocumentSchema = z.object({
  vehicleId: z.string().min(1),
  docType: z.enum(VEHICLE_DOC_TYPES),
  docNumber: optionalText,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  verificationStatus: z.enum(VERIFICATION_STATUSES),
}).refine((d) => !d.issueDate || !d.expiryDate || d.expiryDate >= d.issueDate, {
  message: "Expiry date cannot be before the issue date.",
  path: ["expiryDate"],
});

export type VehicleDocumentInput = z.infer<typeof vehicleDocumentSchema>;
