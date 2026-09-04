import { z } from "zod";
import { MaintenanceType } from "@prisma/client";

export const maintenanceSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required."),
  maintenanceType: z.nativeEnum(MaintenanceType, { message: "Maintenance type is required." }),
  serviceDate: z.string().min(1, "Service date is required."),
  odometerKm: z.coerce.number().nonnegative("Must be zero or greater."),
  serviceCenterVendor: z.string().optional().default(""),
  technician: z.string().optional().default(""),
  workPerformed: z.string().optional().default(""),
  partsReplaced: z.string().optional().default(""),
  labourCost: z.coerce.number().nonnegative().default(0),
  partsCost: z.coerce.number().nonnegative().default(0),
  otherCost: z.coerce.number().nonnegative().default(0),
  remarks: z.string().optional().default(""),
  markUnderMaintenance: z.coerce.boolean().optional().default(false),
});

export type MaintenanceInput = z.infer<typeof maintenanceSchema>;

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  REGULAR_SERVICE: "Regular Service",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  OIL_CHANGE: "Oil Change",
  TYRE_REPLACEMENT: "Tyre Replacement",
  BRAKE_SERVICE: "Brake Service",
  ENGINE_REPAIR: "Engine Repair",
  ELECTRICAL_REPAIR: "Electrical Repair",
  ACCIDENT_REPAIR: "Accident Repair",
  EMERGENCY_REPAIR: "Emergency Repair",
  OTHER: "Other",
};
