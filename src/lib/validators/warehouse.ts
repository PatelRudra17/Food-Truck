import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable();

export const warehouseSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(30),
  name: z.string().trim().min(1, "Name is required.").max(150),
  address: optionalText(500),
  managerId: z.string().min(1).nullable().optional(),
  contact: optionalText(50),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type WarehouseInput = z.infer<typeof warehouseSchema>;

export const locationSchema = z.object({
  warehouseId: z.string().min(1, "Warehouse is required."),
  rack: optionalText(50),
  shelf: optionalText(50),
  bin: optionalText(50),
});

export type LocationInput = z.infer<typeof locationSchema>;
