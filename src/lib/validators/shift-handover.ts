import { z } from "zod";

export const shiftHandoverSchema = z.object({
  shiftId: z.string().min(1, "Shift is required."),
  previousSupervisorId: z.string().optional().default(""),
  newSupervisorId: z.string().optional().default(""),
  stockIssuesNote: z.string().optional().default(""),
  cleaningStatusNote: z.string().optional().default(""),
  crateStatusNote: z.string().optional().default(""),
  remarks: z.string().optional().default(""),
});

export type ShiftHandoverInput = z.infer<typeof shiftHandoverSchema>;
