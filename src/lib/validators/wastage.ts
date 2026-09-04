import { z } from "zod";
import { Grade, WastageReason } from "@prisma/client";

export const WASTE_REASON_LABELS: Record<string, string> = {
  DAMAGED: "Damaged",
  ROTTEN: "Rotten",
  QUALITY_REJECTION: "Quality Rejection",
  HANDLING_DAMAGE: "Handling Damage",
  EXPIRED: "Expired",
  OTHER: "Other",
};

export const GRADE_LABELS: Record<string, string> = {
  RAW: "Raw",
  GRADE_A: "Grade A",
  GRADE_B: "Grade B",
  GRADE_C: "Grade C",
  OTHER: "Other",
};

/** Manual/standalone warehouse dumping — `stage: WAREHOUSE` on the Wastage model. */
export const warehouseWastageSchema = z.object({
  itemId: z.string().min(1, "Item is required."),
  warehouseId: z.string().min(1, "Warehouse is required."),
  grade: z.nativeEnum(Grade, { message: "Grade is required." }),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  reason: z.nativeEnum(WastageReason, { message: "Reason is required." }),
  disposalMethod: z.string().optional().default(""),
  date: z.string().min(1, "Date is required."),
  remarks: z.string().optional().default(""),
});

export type WarehouseWastageInput = z.infer<typeof warehouseWastageSchema>;

export const wastageDecisionSchema = z.object({
  id: z.string().min(1),
  comment: z.string().optional().or(z.literal("")),
});
