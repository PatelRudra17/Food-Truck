import { describe, expect, it } from "vitest";
import { maintenanceSchema } from "@/lib/validators/maintenance";
import { vehicleSchema, vehicleDocumentSchema } from "@/lib/validators/vehicle";
import { driverSchema, driverDocumentSchema } from "@/lib/validators/driver";
import { shiftSchema } from "@/lib/validators/shift";

const maintenanceBase = {
  vehicleId: "veh_1",
  maintenanceType: "OIL_CHANGE",
  serviceDate: "2026-10-01",
  odometerKm: "1000",
};

describe("maintenanceSchema.markUnderMaintenance", () => {
  it.each([
    ["false", false],
    ["true", true],
    ["on", true],
    [undefined, false],
  ])("parses FormData value %s as %s", (value, expected) => {
    expect(maintenanceSchema.parse({ ...maintenanceBase, markUnderMaintenance: value }).markUnderMaintenance).toBe(
      expected,
    );
  });
});

describe("vehicleSchema", () => {
  const base = { vehicleNumber: "  mh12   ab1234 ", vehicleType: " Truck ", status: "AVAILABLE" };

  it("normalises the vehicle number and type", () => {
    const v = vehicleSchema.parse(base);
    expect(v.vehicleNumber).toBe("MH12AB1234");
    expect(v.vehicleType).toBe("Truck");
  });

  it("parses optional fuel target / service schedule fields", () => {
    const v = vehicleSchema.parse({
      ...base,
      fuelEfficiencyTargetKmpl: "8.5",
      serviceIntervalDays: "90",
      serviceIntervalKm: "",
    });
    expect(v.fuelEfficiencyTargetKmpl).toBe(8.5);
    expect(v.serviceIntervalDays).toBe(90);
    expect(v.serviceIntervalKm).toBeUndefined();
  });

  it("accepts its own parsed output (the form parses, then the server action re-parses)", () => {
    const once = vehicleSchema.parse({ ...base, fuelEfficiencyTargetKmpl: "8.5", serviceIntervalDays: "90" });
    const twice = vehicleSchema.parse(once);
    expect(twice.fuelEfficiencyTargetKmpl).toBe(8.5);
    expect(twice.serviceIntervalDays).toBe(90);
  });

  it("rejects non-positive or fractional-day schedule values", () => {
    expect(vehicleSchema.safeParse({ ...base, fuelEfficiencyTargetKmpl: "0" }).success).toBe(false);
    expect(vehicleSchema.safeParse({ ...base, serviceIntervalDays: "1.5" }).success).toBe(false);
  });
});

describe("vehicleDocumentSchema", () => {
  const base = { vehicleId: "veh_1", docType: "INSURANCE", verificationStatus: "UNVERIFIED" };

  it("rejects an expiry date before the issue date", () => {
    expect(vehicleDocumentSchema.safeParse({ ...base, issueDate: "2026-05-01", expiryDate: "2026-04-01" }).success).toBe(
      false,
    );
    expect(vehicleDocumentSchema.safeParse({ ...base, issueDate: "2026-05-01", expiryDate: "2027-05-01" }).success).toBe(
      true,
    );
  });
});

describe("driverSchema.mobile", () => {
  const base = { fullName: "Test Driver", status: "ACTIVE" };

  it.each(["abcdef", "12345", "98765abcde"])("rejects %s", (mobile) => {
    expect(driverSchema.safeParse({ ...base, mobile }).success).toBe(false);
  });

  it.each(["9876543210", "+91 98765-43210"])("accepts %s", (mobile) => {
    expect(driverSchema.safeParse({ ...base, mobile }).success).toBe(true);
  });
});

describe("driverDocumentSchema", () => {
  const base = { driverId: "drv_1", verificationStatus: "UNVERIFIED" };

  it("validates and normalises Aadhaar", () => {
    expect(driverDocumentSchema.parse({ ...base, docType: "AADHAAR", plainNumber: "1234 5678 9012" }).plainNumber).toBe(
      "123456789012",
    );
    expect(driverDocumentSchema.safeParse({ ...base, docType: "AADHAAR", plainNumber: "12345" }).success).toBe(false);
  });

  it("validates and uppercases PAN", () => {
    expect(driverDocumentSchema.parse({ ...base, docType: "PAN", plainNumber: "abcde1234f" }).plainNumber).toBe(
      "ABCDE1234F",
    );
    expect(driverDocumentSchema.safeParse({ ...base, docType: "PAN", plainNumber: "12abcde1234f" }).success).toBe(false);
  });

  it("validates driving licence numbers", () => {
    expect(driverDocumentSchema.safeParse({ ...base, docType: "DRIVING_LICENCE", plainNumber: "MH12 20110012345" }).success).toBe(
      true,
    );
    expect(driverDocumentSchema.safeParse({ ...base, docType: "DRIVING_LICENCE", plainNumber: "DL#1" }).success).toBe(false);
  });

  it("leaves non-identity documents unchecked and allows a blank number", () => {
    expect(driverDocumentSchema.safeParse({ ...base, docType: "OTHER", plainNumber: "anything" }).success).toBe(true);
    expect(driverDocumentSchema.safeParse({ ...base, docType: "PAN" }).success).toBe(true);
  });
});

describe("shiftSchema.shiftName", () => {
  it("rejects a whitespace-only name", () => {
    const base = { date: "2026-10-11", startTime: "06:00", endTime: "14:00" };
    expect(shiftSchema.safeParse({ ...base, shiftName: "   " }).success).toBe(false);
    expect(shiftSchema.parse({ ...base, shiftName: " Morning " }).shiftName).toBe("Morning");
  });
});
