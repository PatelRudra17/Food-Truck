import { describe, expect, it } from "vitest";
import { createItemSchema, itemBaseSchema, itemImportRowSchema } from "@/lib/validators/item";

const base = {
  sku: "SKU-1",
  itemCode: "IC-1",
  name: "Tomatoes",
  categoryId: "cat_1",
  unit: "kg",
};

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return result.error?.issues.map((i) => i.path.join(".")) ?? [];
}

describe.each([
  ["createItemSchema", createItemSchema],
  ["itemBaseSchema", itemBaseSchema],
] as const)("%s", (_name, schema) => {
  it("accepts a minimal valid item and keeps blank optionals null", () => {
    const result = schema.safeParse({ ...base, maxStock: "", purchasePrice: null, storageMinTempC: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.maxStock).toBeNull();
      expect(result.data.purchasePrice).toBeNull();
      expect(result.data.storageMinTempC).toBeNull();
    }
  });

  it("rejects a negative purchase price", () => {
    const result = schema.safeParse({ ...base, purchasePrice: -5 });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("purchasePrice");
  });

  it("rejects max stock below min stock", () => {
    const result = schema.safeParse({ ...base, minStock: 50, maxStock: 10 });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("maxStock");
  });

  it("allows max stock equal to min stock", () => {
    expect(schema.safeParse({ ...base, minStock: 10, maxStock: 10 }).success).toBe(true);
  });

  it("rejects min temperature above max temperature", () => {
    const result = schema.safeParse({ ...base, storageMinTempC: 8, storageMaxTempC: 2 });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("storageMinTempC");
  });

  it("allows negative temperatures in a valid range", () => {
    expect(schema.safeParse({ ...base, storageMinTempC: -18, storageMaxTempC: -10 }).success).toBe(true);
  });
});

describe("itemImportRowSchema", () => {
  const row = { sku: "S", itemCode: "C", name: "N", categoryName: "Veg", unit: "kg" };

  it("rejects a negative purchase price", () => {
    expect(itemImportRowSchema.safeParse({ ...row, purchasePrice: "-1" }).success).toBe(false);
  });

  it("rejects maxStock below minStock", () => {
    const result = itemImportRowSchema.safeParse({ ...row, minStock: "20", maxStock: "5" });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain("maxStock");
  });

  it("accepts maxStock omitted", () => {
    expect(itemImportRowSchema.safeParse({ ...row, minStock: "20" }).success).toBe(true);
  });
});
