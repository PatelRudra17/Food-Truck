import { describe, expect, it } from "vitest";
import { deriveServiceSchedule } from "@/lib/services/maintenance";

const DAY = 24 * 60 * 60 * 1000;

describe("deriveServiceSchedule (after archiving a maintenance record)", () => {
  const base = {
    odometerKm: 12000,
    serviceIntervalDays: 90,
    serviceIntervalKm: 5000,
    nextServiceDate: new Date(Date.now() + 200 * DAY),
    nextServiceKm: 20000,
  };

  it("rebuilds last/next service from the latest remaining record", () => {
    const serviceDate = new Date(Date.now() - 10 * DAY);
    const result = deriveServiceSchedule(base, { serviceDate, odometerKm: 10000 });

    expect(result.lastServiceDate).toEqual(serviceDate);
    expect(result.lastServiceKm?.toNumber()).toBe(10000);
    expect(result.nextServiceDate?.getTime()).toBe(serviceDate.getTime() + 90 * DAY);
    expect(result.nextServiceKm?.toNumber()).toBe(15000);
    expect(result.maintenanceState).toBe("UP_TO_DATE");
  });

  it("flags the vehicle overdue when the remaining record is old", () => {
    const result = deriveServiceSchedule(base, { serviceDate: new Date(Date.now() - 200 * DAY), odometerKm: 5000 });
    expect(result.nextServiceKm?.toNumber()).toBe(10000);
    expect(result.maintenanceState).toBe("OVERDUE");
  });

  it("clears last service and interval-derived next service when no records remain", () => {
    const result = deriveServiceSchedule(base, null);
    expect(result.lastServiceDate).toBeNull();
    expect(result.lastServiceKm).toBeNull();
    expect(result.nextServiceDate).toBeNull();
    expect(result.nextServiceKm).toBeNull();
    expect(result.maintenanceState).toBe("UP_TO_DATE");
  });

  it("keeps manually scheduled next service values when the vehicle has no intervals", () => {
    const manual = { ...base, serviceIntervalDays: null, serviceIntervalKm: null };
    const result = deriveServiceSchedule(manual, { serviceDate: new Date(), odometerKm: 11000 });
    expect(result.nextServiceDate).toEqual(base.nextServiceDate);
    expect(result.nextServiceKm?.toNumber()).toBe(20000);
    expect(result.lastServiceKm?.toNumber()).toBe(11000);
  });
});
