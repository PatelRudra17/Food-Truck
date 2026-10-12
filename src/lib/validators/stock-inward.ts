import { z } from "zod";
import { hasMaxDecimals } from "@/lib/validators/common";

export const inwardItemInputSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  poItemId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit: z.string().min(1, "Unit is required"),
  batchNumber: z.string().optional(),
  serialNumber: z.string().optional(),
  expiryDate: z.string().optional().nullable(),
  // Stored as Decimal(14, 2) / Decimal(5, 2), so extra decimals would be silently rounded.
  rate: z.coerce
    .number()
    .nonnegative("Rate cannot be negative")
    .refine((value) => hasMaxDecimals(value, 2), "Rate can have at most 2 decimal places")
    .optional()
    .nullable(),
  taxPercent: z.coerce
    .number()
    .min(0, "Tax % cannot be negative")
    .max(100, "Tax % cannot exceed 100")
    .refine((value) => hasMaxDecimals(value, 2), "Tax % can have at most 2 decimal places")
    .optional()
    .nullable(),
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
