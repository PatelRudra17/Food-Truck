import { z } from "zod";

export const PERSON_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const labourSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  mobile: z.string().trim().min(6, "Mobile number is required"),
  workType: optionalText,
  dailyWage: z.coerce.number().nonnegative("Daily wage must be zero or greater"),
  shiftId: optionalText,
  status: z.enum(PERSON_STATUSES),
});

export type LabourInput = z.infer<typeof labourSchema>;
