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
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]+$/, "Mobile number can only contain digits, spaces, dashes and a leading +")
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 15;
    }, "Mobile number must have 10–15 digits"),
  workType: optionalText,
  // A blank wage is "not entered" (required error), not 0.
  dailyWage: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number({ error: "Daily wage is required" }).nonnegative("Daily wage must be zero or greater"),
  ),
  shiftId: optionalText,
  status: z.enum(PERSON_STATUSES),
});

export type LabourInput = z.infer<typeof labourSchema>;
