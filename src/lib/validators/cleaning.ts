import { z } from "zod";

export const CLEANING_ENTITY_TYPES = ["VEHICLE", "CRATE", "LOCATION"] as const;
export type CleaningEntityType = (typeof CLEANING_ENTITY_TYPES)[number];

export const CLEANING_ENTITY_TYPE_LABELS: Record<CleaningEntityType, string> = {
  VEHICLE: "Vehicle",
  CRATE: "Crate",
  LOCATION: "Location",
};

export const cleaningSchema = z
  .object({
    entityType: z.enum(CLEANING_ENTITY_TYPES, { message: "Entity type is required." }),
    vehicleId: z.string().optional().default(""),
    crateId: z.string().optional().default(""),
    locationText: z.string().optional().default(""),
    cleaningType: z.string().optional().default(""),
    startTime: z.string().optional().default(""),
    endTime: z.string().optional().default(""),
    staffId: z.string().optional().default(""),
    remarks: z.string().optional().default(""),
  })
  .refine((data) => (data.entityType !== "VEHICLE" || !!data.vehicleId), {
    message: "Vehicle is required for a vehicle cleaning record.",
    path: ["vehicleId"],
  })
  .refine((data) => (data.entityType !== "CRATE" || !!data.crateId), {
    message: "Crate is required for a crate cleaning record.",
    path: ["crateId"],
  })
  .refine((data) => (data.entityType !== "LOCATION" || !!data.locationText.trim()), {
    message: "Location is required for a location cleaning record.",
    path: ["locationText"],
  });

export type CleaningInput = z.infer<typeof cleaningSchema>;

export const updateCleaningSchema = z.object({
  id: z.string().min(1),
  cleaningType: z.string().optional().default(""),
  staffId: z.string().optional().default(""),
  remarks: z.string().optional().default(""),
});

export type UpdateCleaningInput = z.infer<typeof updateCleaningSchema>;
