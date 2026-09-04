import { z } from "zod";

export const inwardItemInputSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  poItemId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit: z.string().min(1, "Unit is required"),
  batchNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  rate: z.coerce.number().nonnegative("Rate cannot be negative").optional().nullable(),
  taxPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const createInwardSchema = z.object({
  date: z.string().min(1, "Date is required"),
  supplierId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  invoiceNumber: z.string().optional(),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
  warehouseId: z.string().min(1, "Warehouse is required"),
  remarks: z.string().optional(),
  items: z.array(inwardItemInputSchema).min(1, "Add at least one line item"),
});

export type InwardItemInput = z.infer<typeof inwardItemInputSchema>;
export type CreateInwardInput = z.infer<typeof createInwardSchema>;

// Editing a draft uses the same shape.
export const updateInwardSchema = createInwardSchema;
export type UpdateInwardInput = z.infer<typeof updateInwardSchema>;
