import { z } from "zod";

const optionalId = z.string().optional().or(z.literal(""));
const optionalText = (max: number) => z.string().max(max).optional().or(z.literal(""));

/** Units measured in kilograms, where a line's weight is its quantity. */
export function isKgUnit(unit: string | null | undefined): boolean {
  return /^(kg|kgs|kilogram|kilograms)$/i.test((unit ?? "").trim());
}

export const procurementLineItemSchema = z
  .object({
    itemId: z.string().min(1, "Item is required"),
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    unit: z.string().min(1, "Unit is required"),
    weight: z.coerce.number().min(0, "Weight cannot be negative"),
    quality: optionalText(200),
    // A blank price input means "no price entered" (stored as null), not 0.
    purchasePrice: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().min(0, "Price cannot be negative").optional(),
    ),
  })
  // For kg items the weight is the quantity, so the two can never disagree.
  .transform((line) => (isKgUnit(line.unit) ? { ...line, weight: line.quantity } : line))
  .refine((line) => line.weight > 0, { message: "Weight must be greater than 0", path: ["weight"] });

export const procurementSchema = z.object({
  supplierId: z.string().min(1, "Supplier is required"),
  date: z.string().min(1, "Date is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  vehicleId: optionalId,
  driverId: optionalId,
  // Unloading is tracked per truck (gate entry); a procurement without one could never be unloaded.
  gateEntryId: z.string().min(1, "Gate entry is required"),
  purchaseOrderId: optionalId,
  invoiceNumber: optionalText(100),
  remarks: optionalText(1000),
  items: z.array(procurementLineItemSchema).min(1, "Add at least one line item"),
});

export type ProcurementInput = z.infer<typeof procurementSchema>;
export type ProcurementLineItemInput = z.infer<typeof procurementLineItemSchema>;
