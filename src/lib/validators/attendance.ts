import { z } from "zod";

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/**
 * Marks (creates or updates) exactly one Attendance row for a given date, for
 * either an Employee or a Labour — never both. The unique constraint on the
 * Attendance model (`@@unique([date, employeeId])` / `@@unique([date, labourId])`)
 * is what the action upserts against.
 */
export const markAttendanceSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    employeeId: optionalText,
    labourId: optionalText,
    shiftId: optionalText,
    status: z.enum(ATTENDANCE_STATUSES),
    overtimeHours: z.coerce.number().min(0, "Cannot be negative").max(24, "Cannot exceed 24 hours").default(0),
    remarks: optionalText,
  })
  .refine((data) => Boolean(data.employeeId) !== Boolean(data.labourId), {
    message: "Exactly one of employee or labour must be specified.",
    path: ["employeeId"],
  });

export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;
