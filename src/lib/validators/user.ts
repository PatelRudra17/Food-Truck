import { z } from "zod";

export const PASSWORD_POLICY_MESSAGE = "Password must be at least 8 characters and include at least one letter and one number.";

/** Returns the policy message when a password is too weak, or null when it is acceptable. */
export function passwordPolicyError(password: string): string | null {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) ? null : PASSWORD_POLICY_MESSAGE;
}

/** Shared password policy for new users, admin resets and self-service changes. */
export const passwordSchema = z
  .string()
  .max(200, "Password is too long.")
  .refine((value) => passwordPolicyError(value) === null, PASSWORD_POLICY_MESSAGE);

export const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  roleId: z.string().min(1, "Role is required."),
  isActive: z.boolean().default(true),
});

export type UserInput = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.extend({
  password: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
