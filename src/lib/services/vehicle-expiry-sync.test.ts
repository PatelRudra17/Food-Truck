import { describe, expect, it } from "vitest";
import { vehicleExpiryUpdateForDocument } from "@/lib/services/vehicle-expiry-sync";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("vehicleExpiryUpdateForDocument", () => {
  it("fills an empty vehicle expiry field from the document", () => {
    expect(vehicleExpiryUpdateForDocument("INSURANCE", d("2027-01-01"), { insuranceExpiry: null })).toEqual({
      insuranceExpiry: d("2027-01-01"),
    });
  });

  it("maps each document type to its own vehicle column", () => {
    const expiry = d("2027-06-30");
    expect(vehicleExpiryUpdateForDocument("REGISTRATION", expiry, {})).toEqual({ registrationExpiry: expiry });
    expect(vehicleExpiryUpdateForDocument("PUC", expiry, {})).toEqual({ pucExpiry: expiry });
    expect(vehicleExpiryUpdateForDocument("FITNESS", expiry, {})).toEqual({ fitnessExpiry: expiry });
    expect(vehicleExpiryUpdateForDocument("PERMIT", expiry, {})).toEqual({ permitExpiry: expiry });
  });

  it("extends the vehicle expiry when the document expires later", () => {
    expect(
      vehicleExpiryUpdateForDocument("PUC", d("2027-03-01"), { pucExpiry: d("2026-03-01") }),
    ).toEqual({ pucExpiry: d("2027-03-01") });
  });

  it("never shortens the vehicle expiry", () => {
    expect(vehicleExpiryUpdateForDocument("PUC", d("2026-01-01"), { pucExpiry: d("2026-03-01") })).toBeNull();
    expect(vehicleExpiryUpdateForDocument("PUC", d("2026-03-01"), { pucExpiry: d("2026-03-01") })).toBeNull();
  });

  it("ignores OTHER documents and documents without an expiry", () => {
    expect(vehicleExpiryUpdateForDocument("OTHER", d("2027-01-01"), {})).toBeNull();
    expect(vehicleExpiryUpdateForDocument("INSURANCE", null, {})).toBeNull();
  });
});
