import { describe, expect, it } from "vitest";
import { computeFuelDerivedFields } from "@/lib/services/fuel";

// computeFuelDerivedFields is the pure mileage/cost-per-km calculation used by
// createFuelEntryAction (src/lib/actions/fuel-actions.ts) — it takes plain
// numbers/Decimals and does no DB access, so it's safe to unit test directly.

describe("computeFuelDerivedFields", () => {
  it("computes distance, total cost, mileage, and cost/km for a normal fill-up", () => {
    const result = computeFuelDerivedFields({
      previousOdometerKm: 1000,
      currentOdometerKm: 1100,
      fuelQuantityLiters: 10,
      fuelRate: 90,
    });

    expect(result.distanceKm.toNumber()).toBe(100);
    expect(result.totalFuelCost.toNumber()).toBe(900);
    expect(result.mileageKmpl.toNumber()).toBe(10); // 100 km / 10 L
    expect(result.fuelCostPerKm.toNumber()).toBe(9); // 900 / 100 km
    expect(result.isAnomaly).toBe(false);
    expect(result.anomalyNote).toBeNull();
  });

  it("throws when the current odometer reading is not greater than the previous one", () => {
    expect(() =>
      computeFuelDerivedFields({
        previousOdometerKm: 1000,
        currentOdometerKm: 1000,
        fuelQuantityLiters: 10,
        fuelRate: 90,
      }),
    ).toThrow("Current odometer reading must be greater than the previous reading.");
  });

  it("throws when fuel quantity is zero or negative", () => {
    expect(() =>
      computeFuelDerivedFields({
        previousOdometerKm: 1000,
        currentOdometerKm: 1100,
        fuelQuantityLiters: 0,
        fuelRate: 90,
      }),
    ).toThrow("Fuel quantity must be greater than zero.");
  });

  it("flags an anomaly when mileage deviates more than 30% from the baseline", () => {
    // baseline 10 km/L, actual mileage here is 100km / 20L = 5 km/L -> 50% deviation
    const result = computeFuelDerivedFields({
      previousOdometerKm: 1000,
      currentOdometerKm: 1100,
      fuelQuantityLiters: 20,
      fuelRate: 90,
      baselineMileageKmpl: 10,
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.anomalyNote).toContain("Unusual fuel consumption detected");
  });

  it("does not flag an anomaly when mileage is within 30% of the baseline", () => {
    // baseline 10 km/L, actual mileage 100km / 11L ≈ 9.09 km/L -> ~9% deviation
    const result = computeFuelDerivedFields({
      previousOdometerKm: 1000,
      currentOdometerKm: 1100,
      fuelQuantityLiters: 11,
      fuelRate: 90,
      baselineMileageKmpl: 10,
    });

    expect(result.isAnomaly).toBe(false);
    expect(result.anomalyNote).toBeNull();
  });

  it("flags implausible mileage (>100 KM/L) when the vehicle has no baseline", () => {
    // 500km on 2L = 250 km/L -> almost certainly a mistyped reading
    const result = computeFuelDerivedFields({
      previousOdometerKm: 1000,
      currentOdometerKm: 1500,
      fuelQuantityLiters: 2,
      fuelRate: 90,
    });

    expect(result.isAnomaly).toBe(true);
    expect(result.anomalyNote).toContain("Implausible fuel consumption");
  });

  it("does not flag ordinary mileage when the vehicle has no baseline", () => {
    const result = computeFuelDerivedFields({
      previousOdometerKm: 1000,
      currentOdometerKm: 1100,
      fuelQuantityLiters: 10,
      fuelRate: 90,
    });

    expect(result.isAnomaly).toBe(false);
  });
});
