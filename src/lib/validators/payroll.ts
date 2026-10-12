import { z } from "zod";

export const PAYROLL_PERSON_TYPES = ["EMPLOYEE", "LABOUR"] as const;
export const PAYMENT_STATUSES = ["PENDING", "PAID"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/**
 * Creates a Salary record for a single pay period. The user enters
 * `earnings` directly for both Employee and Labour; there is deliberately
 * no automatic statutory payroll calculation anywhere in this module.
 */
export const payrollSchema = z
  .object({
    personType: z.enum(PAYROLL_PERSON_TYPES),
    employeeId: optionalText,
    labourId: optionalText,
    periodStart: z.string().min(1, "Period start is required"),
    periodEnd: z.string().min(1, "Period end is required"),
    earnings: z.coerce.number().nonnegative("Earnings must be zero or greater"),
    overtimeAmount: z.coerce.number().nonnegative("Cannot be negative").default(0),
    advances: z.coerce.number().nonnegative("Cannot be negative").default(0),
    deductions: z.coerce.number().nonnegative("Cannot be negative").default(0),
  })
  .refine((data) => (data.personType === "EMPLOYEE" ? Boolean(data.employeeId) : Boolean(data.labourId)), {
    message: "Select a person for the chosen person type.",
    path: ["employeeId"],
  })
  .refine((data) => new Date(data.periodEnd) >= new Date(data.periodStart), {
    message: "Period end must be on or after period start.",
    path: ["periodEnd"],
  })
  .refine((data) => data.earnings + data.overtimeAmount - data.advances - data.deductions >= 0, {
    message: "Advances and deductions can't be more than earnings plus overtime.",
    path: ["deductions"],
  });

export type PayrollInput = z.infer<typeof payrollSchema>;
