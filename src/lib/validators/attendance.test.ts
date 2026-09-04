import { describe, expect, it } from "vitest";
import { markAttendanceSchema } from "@/lib/validators/attendance";

describe("markAttendanceSchema", () => {
  it("parses a valid attendance entry for an employee", () => {
    const result = markAttendanceSchema.safeParse({
      date: "2026-08-31",
      employeeId: "emp_1",
      status: "PRESENT",
      overtimeHours: 2,
    });

    expect(result.success).toBe(true);
  });

  it("parses a valid attendance entry for a labour (not an employee)", () => {
    const result = markAttendanceSchema.safeParse({
      date: "2026-08-31",
      labourId: "lab_1",
      status: "ABSENT",
    });

    expect(result.success).toBe(true);
  });

  it("rejects when neither employeeId nor labourId is specified", () => {
    const result = markAttendanceSchema.safeParse({
      date: "2026-08-31",
      status: "PRESENT",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message === "Exactly one of employee or labour must be specified."),
      ).toBe(true);
    }
  });

  it("rejects when BOTH employeeId and labourId are specified", () => {
    const result = markAttendanceSchema.safeParse({
      date: "2026-08-31",
      employeeId: "emp_1",
      labourId: "lab_1",
      status: "PRESENT",
    });

    expect(result.success).toBe(false);
  });

  it("rejects overtimeHours greater than 24", () => {
    const result = markAttendanceSchema.safeParse({
      date: "2026-08-31",
      employeeId: "emp_1",
      status: "HALF_DAY",
      overtimeHours: 25,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid status value", () => {
    const result = markAttendanceSchema.safeParse({
      date: "2026-08-31",
      employeeId: "emp_1",
      status: "ON_LEAVE", // not a valid ATTENDANCE_STATUSES value
    });

    expect(result.success).toBe(false);
  });
});
