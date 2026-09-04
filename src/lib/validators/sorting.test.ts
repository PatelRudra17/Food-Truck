import { describe, expect, it } from "vitest";
import { buildSortingSchema } from "@/lib/validators/sorting";

describe("buildSortingSchema", () => {
  const rawWeight = 100;

  it("accepts a perfectly balanced set of grade weights and waste", () => {
    const schema = buildSortingSchema(rawWeight);
    const result = schema.safeParse({
      batchId: "batch_1",
      gradeAWeight: 40,
      gradeBWeight: 30,
      gradeCWeight: 20,
      otherGradeWeight: 5,
      wasteWeight: 5,
      wasteReason: "DAMAGED",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unbalanced set (grades + waste don't add up to raw weight)", () => {
    const schema = buildSortingSchema(rawWeight);
    const result = schema.safeParse({
      batchId: "batch_1",
      gradeAWeight: 40,
      gradeBWeight: 30,
      gradeCWeight: 20,
      otherGradeWeight: 0,
      wasteWeight: 0, // totals 90, not 100
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("must add up to the raw weight"))).toBe(true);
    }
  });

  it("accepts the all-waste edge case (rawWeight === wasteWeight, all grades zero)", () => {
    const schema = buildSortingSchema(rawWeight);
    const result = schema.safeParse({
      batchId: "batch_1",
      gradeAWeight: 0,
      gradeBWeight: 0,
      gradeCWeight: 0,
      otherGradeWeight: 0,
      wasteWeight: 100,
      wasteReason: "ROTTEN",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a positive waste weight with no waste reason", () => {
    const schema = buildSortingSchema(rawWeight);
    const result = schema.safeParse({
      batchId: "batch_1",
      gradeAWeight: 95,
      gradeBWeight: 0,
      gradeCWeight: 0,
      otherGradeWeight: 0,
      wasteWeight: 5,
      // wasteReason intentionally omitted
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes("Waste reason is required"))).toBe(true);
    }
  });

  it("rejects a negative grade weight", () => {
    const schema = buildSortingSchema(rawWeight);
    const result = schema.safeParse({
      batchId: "batch_1",
      gradeAWeight: -10,
      gradeBWeight: 60,
      gradeCWeight: 30,
      otherGradeWeight: 15,
      wasteWeight: 5,
      wasteReason: "OTHER",
    });

    expect(result.success).toBe(false);
  });
});
