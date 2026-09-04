import { z } from "zod";

export const createAdjustmentSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  warehouseId: z.string().min(1, "Warehouse is required"),
  physicalQty: z.coerce.number().min(0, "Physical quantity cannot be negative"),
  reason: z.string().min(3, "Reason is required (e.g. physical count mismatch, damaged stock)"),
});

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentSchema>;

export const adjustmentDecisionSchema = z.object({
  id: z.string().min(1),
  comment: z.string().optional().or(z.literal("")),
});
