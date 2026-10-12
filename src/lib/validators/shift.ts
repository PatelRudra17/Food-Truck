import { z } from "zod";

export const shiftSchema = z.object({
  shiftName: z.string().trim().min(1, "Shift name is required."),
  date: z.string().min(1, "Date is required."),
  startTime: z.string().min(1, "Start time is required."),
  endTime: z.string().min(1, "End time is required."),
  supervisorId: z.string().optional().default(""),
});

export type ShiftInput = z.infer<typeof shiftSchema>;

export const assignSupervisorSchema = z.object({
  shiftId: z.string().min(1),
  supervisorId: z.string().optional().default(""),
});

export type AssignSupervisorInput = z.infer<typeof assignSupervisorSchema>;
