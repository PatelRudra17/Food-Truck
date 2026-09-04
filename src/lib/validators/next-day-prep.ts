import { z } from "zod";

/** Default checklist seeded for every new preparation, per the build doc's Next-Day Preparation spec. */
export const DEFAULT_CHECKLIST_LABELS = [
  "Vehicle availability",
  "Driver availability",
  "Crates ready",
  "Cleaning completed",
  "Inventory ready",
  "Pending orders reviewed",
  "Procurement planned",
  "Dispatch planned",
  "Warehouse prepared",
  "Staff allocated",
] as const;

export const nextDayPreparationSchema = z.object({
  date: z.string().min(1, "Date is required."),
  remarks: z.string().optional().default(""),
});

export type NextDayPreparationInput = z.infer<typeof nextDayPreparationSchema>;

export const updatePreparationRemarksSchema = z.object({
  id: z.string().min(1),
  remarks: z.string().optional().default(""),
});

export const assignChecklistItemSchema = z.object({
  itemId: z.string().min(1),
  assignedToId: z.string().min(1, "Select a person to assign this to."),
});

export const checklistRemarkSchema = z.object({
  itemId: z.string().min(1),
  remark: z.string().optional().default(""),
});

export const reopenChecklistItemSchema = z.object({
  itemId: z.string().min(1),
  reason: z.string().min(1, "A reason is required to reopen this item."),
});
