import { describe, expect, it } from "vitest";
import type { Vehicle } from "@prisma/client";
import { checkDispatchEligibility } from "@/lib/services/dispatch";

/**
 * checkDispatchEligibility() only reads a handful of fields off the Vehicle
 * object (status, maintenanceState, maintenanceOverride, and the expiry
 * dates) and performs no DB access. We build a plain fake object with just
 * those fields and cast it through `unknown` to `Vehicle` rather than filling
 * in every unrelated column (odometer, capacity, relations, ...).
 */
function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  const future = new Date();
  future.setFullYear(future.getFullYear() + 1);

  const base = {
    status: "AVAILABLE",
    maintenanceState: "UP_TO_DATE",
    maintenanceOverride: false,
    registrationExpiry: future,
    insuranceExpiry: future,
    pucExpiry: future,
    fitnessExpiry: future,
    permitExpiry: future,
    ...overrides,
  };

  return base as unknown as Vehicle;
}

describe("checkDispatchEligibility", () => {
  it("allows a valid, available vehicle with no issues", () => {
    const result = checkDispatchEligibility(makeVehicle());
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks a vehicle with expired insurance", () => {
    const past = new Date("2020-01-01");
    const result = checkDispatchEligibility(makeVehicle({ insuranceExpiry: past }));
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Insurance has expired.");
  });

  it("blocks a vehicle with overdue maintenance and no override", () => {
    const result = checkDispatchEligibility(
      makeVehicle({ maintenanceState: "OVERDUE", maintenanceOverride: false }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Vehicle maintenance is overdue.");
  });

  it("allows a vehicle with overdue maintenance when maintenanceOverride is set", () => {
    const result = checkDispatchEligibility(
      makeVehicle({ maintenanceState: "OVERDUE", maintenanceOverride: true }),
    );
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks a vehicle marked inactive", () => {
    const result = checkDispatchEligibility(makeVehicle({ status: "INACTIVE" }));
    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain("Vehicle is marked inactive.");
  });

  it("blocks a vehicle whose status is not dispatch-eligible (e.g. ON_TRIP)", () => {
    const result = checkDispatchEligibility(makeVehicle({ status: "ON_TRIP" }));
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.includes("not available for dispatch"))).toBe(true);
  });

  it("does not block on a missing (null) permit expiry — permit is only checked when configured", () => {
    const result = checkDispatchEligibility(makeVehicle({ permitExpiry: null }));
    expect(result.allowed).toBe(true);
  });
});
