import { describe, expect, it } from "vitest";
import { procurementSchema } from "@/lib/validators/procurement";

describe("procurementSchema", () => {
  it("parses a valid procurement with one line item", () => {
    const result = procurementSchema.safeParse({
      supplierId: "sup_1",
      date: "2026-08-31",
      warehouseId: "wh_1",
      vehicleId: "",
      driverId: "",
      gateEntryId: "",
      purchaseOrderId: "",
      invoiceNumber: "INV-001",
      remarks: "",
      items: [
        {
          itemId: "item_1",
          quantity: 100,
          unit: "kg",
          weight: 100,
          quality: "Grade A",
          purchasePrice: 25,
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a procurement with no line items", () => {
    const result = procurementSchema.safeParse({
      supplierId: "sup_1",
      date: "2026-08-31",
      warehouseId: "wh_1",
      items: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "items")).toBe(true);
    }
  });

  it("rejects when supplierId is missing", () => {
    const result = procurementSchema.safeParse({
      date: "2026-08-31",
      warehouseId: "wh_1",
      items: [{ itemId: "item_1", quantity: 10, unit: "kg", weight: 10 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "supplierId")).toBe(true);
    }
  });

  it("rejects a line item with zero/negative quantity", () => {
    const result = procurementSchema.safeParse({
      supplierId: "sup_1",
      date: "2026-08-31",
      warehouseId: "wh_1",
      items: [{ itemId: "item_1", quantity: 0, unit: "kg", weight: 10 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a line item whose quantity is the wrong type and cannot be coerced", () => {
    const result = procurementSchema.safeParse({
      supplierId: "sup_1",
      date: "2026-08-31",
      warehouseId: "wh_1",
      items: [{ itemId: "item_1", quantity: "not-a-number", unit: "kg", weight: 10 }],
    });

    expect(result.success).toBe(false);
  });
});
