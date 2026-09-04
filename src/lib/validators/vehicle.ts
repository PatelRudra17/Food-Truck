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

/**
 * Deliberately excludes fuelType/odometerKm/fuelEfficiencyTargetKmpl/fuelCostPerKmTarget/
 * lastServiceDate/lastServiceKm/nextServiceDate/nextServiceKm/serviceIntervalDays/
 * serviceIntervalKm/maintenanceState/maintenanceOverride — those belong to the
 * Fuel/Maintenance modules and are left at schema defaults here.
 */
export const vehicleSchema = z.object({
  vehicleNumber: z.string().trim().min(2, "Vehicle number is required").max(20),
  vehicleType: z.string().trim().min(1, "Vehicle type is required"),
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
});

export type VehicleInput = z.infer<typeof vehicleSchema>;

export const vehicleDocumentSchema = z.object({
  vehicleId: z.string().min(1),
  docType: z.enum(VEHICLE_DOC_TYPES),
  docNumber: optionalText,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  verificationStatus: z.enum(VERIFICATION_STATUSES),
});

export type VehicleDocumentInput = z.infer<typeof vehicleDocumentSchema>;
