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
  mobile: z.string().trim().min(6, "Mobile number is required"),
  department: optionalText,
  roleTitle: optionalText,
  joiningDate: optionalDate,
  shiftId: optionalText,
  status: z.enum(PERSON_STATUSES),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
