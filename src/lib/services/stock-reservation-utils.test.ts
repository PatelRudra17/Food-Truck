import { describe, expect, it } from "vitest";
import { freeStock, reservationShortfallMessage, sumQtyByItem } from "./stock-reservation-utils";
import { isSelfApproval, systemSettingsSchema } from "@/lib/validators/settings";
import { APPROVAL_CENTER_PERMISSIONS, approvableEntityTypes } from "@/lib/approval-permissions";

describe("outward stock reservation", () => {
  it("sums repeated lines per item", () => {
    const totals = sumQtyByItem([
      { itemId: "a", quantity: 40 },
      { itemId: "b", quantity: "1.5" },
      { itemId: "a", quantity: 50 },
    ]);
    expect(totals.get("a")?.toNumber()).toBe(90);
    expect(totals.get("b")?.toNumber()).toBe(1.5);
  });

  it("free stock is balance minus quantities reserved by other outwards", () => {
    expect(freeStock(129, 90).toNumber()).toBe(39);
  });

  it("blocks the second 90-unit outward against 129 in stock (QA scenario)", () => {
    expect(reservationShortfallMessage({ itemLabel: '"Tomato"', requested: 90, balance: 129, reserved: 0 })).toBeNull();
    const message = reservationShortfallMessage({ itemLabel: '"Tomato"', requested: 90, balance: 129, reserved: 90 });
    expect(message).toContain("exceeds available stock (39)");
    expect(message).toContain("90 already reserved");
  });

  it("allows a request that exactly uses the free stock", () => {
    expect(reservationShortfallMessage({ itemLabel: "x", requested: 39, balance: 129, reserved: 90 })).toBeNull();
  });

  it("never reports negative free stock", () => {
    expect(reservationShortfallMessage({ itemLabel: "x", requested: 5, balance: 10, reserved: 20 })).toContain(
      "available stock (0)",
    );
  });
});

describe("separation of duties", () => {
  it("flags the creator or submitter approving their own request", () => {
    expect(isSelfApproval("u1", ["u1", "u2"])).toBe(true);
    expect(isSelfApproval("u1", ["u2", undefined, null])).toBe(false);
  });

  it("REQUIRE_SEPARATE_APPROVER defaults to off", () => {
    const parsed = systemSettingsSchema.parse({
      companyName: "Acme",
      currency: "INR",
      dateFormat: "DD/MM/YYYY",
      timeZone: "Asia/Calcutta",
      allowNegativeStock: false,
      documentExpiryWarningDays: [7],
      highWastageThresholdPercent: 15,
      crateOverdueThresholdDays: 14,
    });
    expect(parsed.requireSeparateApprover).toBe(false);
  });
});

describe("approval center access", () => {
  it("lists only workflows whose APPROVE permission the user holds", () => {
    expect(approvableEntityTypes(["STOCK_OUTWARD_APPROVE", "PURCHASE_ORDER_APPROVE", "ITEM_VIEW"])).toEqual([
      "StockOutward",
      "PurchaseOrder",
    ]);
    expect(approvableEntityTypes(["MANAGE_SETTINGS"])).toEqual([]);
  });

  it("opens for settings admins and any approver", () => {
    expect(APPROVAL_CENTER_PERMISSIONS).toContain("MANAGE_SETTINGS");
    expect(APPROVAL_CENTER_PERMISSIONS).toContain("STOCK_ADJUSTMENT_APPROVE");
  });
});
