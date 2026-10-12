import { describe, expect, it } from "vitest";
import { createUserSchema, passwordPolicyError, resetPasswordSchema, PASSWORD_POLICY_MESSAGE } from "./user";
import { changePasswordSchema } from "./profile";

describe("password policy", () => {
  it.each(["short1", "abcdefgh", "12345678", ""])("rejects %j", (pw) => {
    expect(passwordPolicyError(pw)).toBe(PASSWORD_POLICY_MESSAGE);
  });
  it.each(["abcdefg1", "Passw0rd!", "1234567a"])("accepts %j", (pw) => {
    expect(passwordPolicyError(pw)).toBeNull();
  });

  it("applies to create user, admin reset and change-own-password", () => {
    const base = { name: "A", email: "a@b.co", roleId: "r", isActive: true };
    expect(createUserSchema.safeParse({ ...base, password: "password" }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, password: "password1" }).success).toBe(true);
    const reset = resetPasswordSchema.safeParse({ newPassword: "12345678" });
    expect(reset.success).toBe(false);
    expect(reset.error?.issues[0]?.message).toBe(PASSWORD_POLICY_MESSAGE);
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "abcdefgh" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "abcdefg9" }).success).toBe(true);
  });
});
