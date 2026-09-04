import { z } from "zod";

const optionalId = z.string().optional().or(z.literal(""));
const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(""));

export const procurementLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  weight: z.coerce.number().positive("Weight must be greater than 0"),
  quality: optionalText(200),
  purchasePrice: z.coerce.number().min(0, "Price cannot be negative").optional(),
});

export const procurementSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  date: z.string().min(1, "Date is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  vehicleId: optionalId,
  driverId: optionalId,
  gateEntryId: optionalId,
  purchaseOrderId: optionalId,
  invoiceNumber: optionalText(100),
  remarks: optionalText(1000),
  items: z.array(procurementLineItemSchema).min(1, "Add at least one line item"),
});

export type ProcurementInput = z.infer<typeof procurementSchema>;
export type ProcurementLineItemInput = z.infer<typeof procurementLineItemSchema>;
