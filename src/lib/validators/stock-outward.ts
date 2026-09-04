import { z } from "zod";

export const outwardItemInputSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  requestedQty: z.coerce.number().positive("Quantity must be greater than zero"),
  unit: z.string().min(1, "Unit is required"),
  batchNumber: z.string().optional(),
  serialNumber: z.string().optional(),
});

export const createOutwardSchema = z.object({
  date: z.string().min(1, "Date is required"),
  department: z.string().optional(),
  project: z.string().optional(),
  warehouseId: z.string().min(1, "Warehouse is required"),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  destination: z.string().optional(),
  receiver: z.string().optional(),
  purpose: z.string().optional(),
  remarks: z.string().optional(),
  items: z.array(outwardItemInputSchema).min(1, "Add at least one line item"),
});

export type OutwardItemInput = z.infer<typeof outwardItemInputSchema>;
export type CreateOutwardInput = z.infer<typeof createOutwardSchema>;

export const updateOutwardSchema = createOutwardSchema;
export type UpdateOutwardInput = z.infer<typeof updateOutwardSchema>;
