import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const recordVehicleInSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required."),
  driverId: z.string().min(1, "Driver is required."),
  supplierId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  purpose: optionalText(300),
  material: optionalText(300),
  remarks: optionalText(1000),
});

export type RecordVehicleInInput = z.infer<typeof recordVehicleInSchema>;

export const recordVehicleOutSchema = z.object({
  gateEntryId: z.string().min(1, "Gate entry is required."),
  destination: optionalText(300),
  material: optionalText(300),
  receiver: optionalText(200),
  remarks: optionalText(1000),
});

export type RecordVehicleOutInput = z.infer<typeof recordVehicleOutSchema>;

export const gateActivityFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
  vehicleId: z.string().optional(),
});

export type GateActivityFilter = z.infer<typeof gateActivityFilterSchema>;
