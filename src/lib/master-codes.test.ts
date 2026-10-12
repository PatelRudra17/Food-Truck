import { describe, expect, it } from "vitest";
import { isUniqueConflict, maxCodeSuffix, nextCodeFromMax, retryOnUniqueConflict } from "./master-codes";
import { inwardItemInputSchema } from "@/lib/validators/stock-inward";
import { hasMaxDecimals } from "@/lib/validators/common";

function p2002(target: string[]) {
  return Object.assign(new Error("Unique constraint failed"), {
    name: "PrismaClientKnownRequestError",
    code: "P2002",
    meta: { target },
  });
}

describe("master codes", () => {
  it("continues from the highest suffix, not the row count", () => {
    // EMP-002 was deleted: a count+1 would reissue EMP-003.
    expect(nextCodeFromMax("EMP", maxCodeSuffix("EMP", ["EMP-001", "EMP-003"]))).toBe("EMP-004");
  });
  it("starts at 001 and ignores codes of another shape", () => {
    expect(nextCodeFromMax("LAB", maxCodeSuffix("LAB", []))).toBe("LAB-001");
    expect(maxCodeSuffix("LAB", ["LAB-007", "LAB-X1", "EMP-099"])).toBe(7);
    expect(nextCodeFromMax("LAB", 999)).toBe("LAB-1000");
  });
  it("detects unique conflicts on the code column only", () => {
    expect(isUniqueConflict(p2002(["employeeCode"]), "employeeCode")).toBe(true);
    expect(isUniqueConflict(p2002(["mobile"]), "employeeCode")).toBe(false);
    expect(isUniqueConflict(new Error("x"), "employeeCode")).toBe(false);
  });
  it("retries the whole attempt after a lost race", async () => {
    let calls = 0;
    const result = await retryOnUniqueConflict("labourCode", async () => {
      calls++;
      if (calls < 3) throw p2002(["labourCode"]);
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });
  it("gives up after the attempt limit and rethrows other errors immediately", async () => {
    let calls = 0;
    await expect(
      retryOnUniqueConflict(
        "labourCode",
        async () => {
          calls++;
          throw p2002(["labourCode"]);
        },
        2,
      ),
    ).rejects.toThrow();
    expect(calls).toBe(2);
    await expect(retryOnUniqueConflict("labourCode", async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
  });
});

describe("inward rate precision", () => {
  const line = { itemId: "i", quantity: 1, unit: "kg" };
  it("rejects a rate with more than 2 decimals with a field message", () => {
    const result = inwardItemInputSchema.safeParse({ ...line, rate: "10.555" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["rate"]);
    expect(result.error?.issues[0]?.message).toBe("Rate can have at most 2 decimal places");
  });
  it("accepts 2-decimal rates", () => {
    expect(inwardItemInputSchema.safeParse({ ...line, rate: "10.55", taxPercent: "18.5" }).success).toBe(true);
    expect(hasMaxDecimals(1.13, 2)).toBe(true);
    expect(hasMaxDecimals(0.29, 2)).toBe(true);
  });
});
