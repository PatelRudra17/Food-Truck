import { z } from "zod";

export const PERSON_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[\d\s-]+$/, "Mobile number can only contain digits, spaces, dashes and a leading +")
    .refine((v) => {
      const digits = v.replace(/\D/g, "").length;
      return digits >= 10 && digits <= 15;
    }, "Mobile number must have 10–15 digits"),
  department: optionalText,
  roleTitle: optionalText,
  joiningDate: optionalDate,
  shiftId: optionalText,
  status: z.enum(PERSON_STATUSES),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
