import { describe, expect, it } from "vitest";
import { supplierSchema } from "@/lib/validators/supplier";
import { customerSchema } from "@/lib/validators/customer";

const PHONE_ERROR = "Enter a valid phone number (10–15 digits; +, spaces and dashes allowed).";

const cases = [
  { name: "supplierSchema", parse: (phone: string) => supplierSchema.safeParse({ code: "S1", companyName: "Acme", phone }) },
  { name: "customerSchema", parse: (phone: string) => customerSchema.safeParse({ name: "Acme", phone }) },
];

describe.each(cases)("$name phone", ({ parse }) => {
  it.each(["", "   ", "9876543210", "+91 98765 43210", "+91-98765-43210", "022-2345-6789"])("accepts %j", (phone) => {
    expect(parse(phone).success).toBe(true);
  });

  it.each(["abcxyz", "98765abc10", "12345", "1234567890123456", "++919876543210", "98765 43210 ext 2"])(
    "rejects %j",
    (phone) => {
      const result = parse(phone);
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((i) => i.message)).toContain(PHONE_ERROR);
    },
  );

  it("accepts a missing phone", () => {
    expect(parse(undefined as unknown as string).success).toBe(true);
  });
});
