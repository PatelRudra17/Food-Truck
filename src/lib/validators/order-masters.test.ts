import { describe, expect, it } from "vitest";
import { supplierSchema } from "@/lib/validators/supplier";
import { customerSchema } from "@/lib/validators/customer";
import { routeSchema } from "@/lib/validators/route";
import { purchaseOrderSchema } from "@/lib/validators/purchase-order";
import { salesOrderSchema } from "@/lib/validators/sales-order";

const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((i) => i.message);

describe("supplierSchema / customerSchema trimming", () => {
  it("rejects whitespace-only supplier code and company name", () => {
    const result = supplierSchema.safeParse({ code: "   ", companyName: "  " });
    expect(result.success).toBe(false);
    expect(messages(result)).toEqual(expect.arrayContaining(["Code is required", "Company name is required"]));
  });

  it("trims supplier fields", () => {
    const result = supplierSchema.parse({ code: " SUP-1 ", companyName: " Acme ", contactPerson: "  " });
    expect(result.code).toBe("SUP-1");
    expect(result.companyName).toBe("Acme");
    expect(result.contactPerson).toBe("");
  });

  it("rejects a whitespace-only customer name", () => {
    expect(messages(customerSchema.safeParse({ name: "   " }))).toContain("Name is required");
  });
});

describe("routeSchema friendly numeric messages", () => {
  const base = { name: "R1", startLocation: "A", destination: "B" };

  it("explains a negative distance / time", () => {
    const result = routeSchema.safeParse({ ...base, estimatedDistanceKm: -1, estimatedTimeMinutes: -5 });
    expect(messages(result)).toEqual(
      expect.arrayContaining(["Estimated distance cannot be negative.", "Estimated time cannot be negative."]),
    );
  });

  it("explains a fractional time or non-numeric distance", () => {
    expect(messages(routeSchema.safeParse({ ...base, estimatedTimeMinutes: 1.5 }))).toContain(
      "Estimated time must be a whole number of 0 or more.",
    );
    expect(messages(routeSchema.safeParse({ ...base, estimatedDistanceKm: "abc" }))).toContain(
      "Estimated distance must be a number of 0 or more.",
    );
  });

  it("still maps blank optional numbers to null", () => {
    const result = routeSchema.parse({ ...base, estimatedDistanceKm: "", estimatedTimeMinutes: "" });
    expect(result.estimatedDistanceKm).toBeNull();
    expect(result.estimatedTimeMinutes).toBeNull();
  });
});

describe("order date ordering", () => {
  const poBase = { supplierId: "s1", date: "2026-10-10", items: [{ itemId: "i1", quantity: 1, rate: 1 }] };
  const soBase = { customerId: "c1", orderDate: "2026-10-10", items: [{ itemId: "i1", quantity: 1, rate: 1 }] };

  it("rejects a PO expected delivery before the PO date", () => {
    expect(messages(purchaseOrderSchema.safeParse({ ...poBase, expectedDelivery: "2026-10-09" }))).toContain(
      "Expected delivery cannot be before the order date",
    );
  });

  it("accepts a PO expected delivery on/after the PO date or blank", () => {
    expect(purchaseOrderSchema.safeParse({ ...poBase, expectedDelivery: "2026-10-10" }).success).toBe(true);
    expect(purchaseOrderSchema.safeParse({ ...poBase, expectedDelivery: "" }).success).toBe(true);
  });

  it("rejects an SO delivery date before the order date", () => {
    expect(messages(salesOrderSchema.safeParse({ ...soBase, deliveryDate: "2026-10-01" }))).toContain(
      "Delivery date cannot be before the order date",
    );
    expect(salesOrderSchema.safeParse({ ...soBase, deliveryDate: "2026-10-11" }).success).toBe(true);
  });
});
