import { z } from "zod";

export const poLineItemSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0, "Rate cannot be negative"),
  taxPercent: z.coerce.number().min(0, "Tax cannot be negative").max(100, "Tax cannot exceed 100%").optional(),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  date: z.string().min(1, "Date is required"),
  expectedDelivery: z.string().optional().or(z.literal("")),
  remarks: z.string().max(1000).optional().or(z.literal("")),
  items: z.array(poLineItemSchema).min(1, "Add at least one line item"),
});

export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type PoLineItemInput = z.infer<typeof poLineItemSchema>;
