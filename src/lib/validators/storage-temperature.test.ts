import { describe, expect, it } from "vitest";
import { temperatureLogSchema, temperatureSettingsSchema } from "@/lib/validators/storage-temperature";

describe("temperatureSettingsSchema", () => {
  it("keeps blank min/max/shelf-life as null instead of 0", () => {
    for (const blank of ["", null, undefined]) {
      const result = temperatureSettingsSchema.safeParse({
        isTemperatureSensitive: true,
        storageMinTempC: blank,
        storageMaxTempC: blank,
        shelfLifeDays: blank,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storageMinTempC).toBeNull();
        expect(result.data.storageMaxTempC).toBeNull();
        expect(result.data.shelfLifeDays).toBeNull();
      }
    }
  });

  it("still parses real numbers, including 0", () => {
    const result = temperatureSettingsSchema.safeParse({ storageMinTempC: "0", storageMaxTempC: 4, shelfLifeDays: "7" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.storageMinTempC).toBe(0);
      expect(result.data.storageMaxTempC).toBe(4);
      expect(result.data.shelfLifeDays).toBe(7);
    }
  });

  it("rejects min > max with a readable message", () => {
    const result = temperatureSettingsSchema.safeParse({ storageMinTempC: 10, storageMaxTempC: 2 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Minimum temperature must not exceed the maximum.");
  });
});

describe("temperatureLogSchema", () => {
  const base = { itemId: "i", warehouseId: "w" };

  it("rejects an out-of-range reading with a readable message", () => {
    const result = temperatureLogSchema.safeParse({ ...base, recordedTempC: 100 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Temperature must be between -50°C and 80°C.");
  });

  it("accepts an in-range reading", () => {
    expect(temperatureLogSchema.safeParse({ ...base, recordedTempC: "4.5" }).success).toBe(true);
  });
});
