import { describe, expect, it } from "vitest";
import { createTripSchema } from "@/lib/validators/trip";

describe("createTripSchema", () => {
  const baseItems = [{ itemId: "item_1", grade: "GRADE_A" as const, quantity: 10, cratesCount: 2 }];

  it("parses a valid standalone dispatch (no salesOrderId) with no override", () => {
    const result = createTripSchema.safeParse({
      customerId: "cust_1",
      vehicleId: "veh_1",
      driverId: "drv_1",
      items: baseItems,
    });

    expect(result.success).toBe(true);
  });

  it("rejects when required customerId is missing", () => {
    const result = createTripSchema.safeParse({
      vehicleId: "veh_1",
      driverId: "drv_1",
      items: baseItems,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "customerId")).toBe(true);
    }
  });

  it("rejects when overrideEligibility is true but no reason is given", () => {
    const result = createTripSchema.safeParse({
      customerId: "cust_1",
      vehicleId: "veh_1",
      driverId: "drv_1",
      items: baseItems,
      overrideEligibility: true,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.path.join(".") === "eligibilityOverrideReason",
        ),
      ).toBe(true);
    }
  });

  it("accepts overrideEligibility: true when a reason is provided", () => {
    const result = createTripSchema.safeParse({
      customerId: "cust_1",
      vehicleId: "veh_1",
      driverId: "drv_1",
      items: baseItems,
      overrideEligibility: true,
      eligibilityOverrideReason: "Vehicle maintenance overdue but urgently needed for delivery.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = createTripSchema.safeParse({
      customerId: "cust_1",
      vehicleId: "veh_1",
      driverId: "drv_1",
      items: [],
    });

    expect(result.success).toBe(false);
  });
});
