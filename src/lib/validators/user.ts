import { z } from "zod";

export const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  roleId: z.string().min(1, "Role is required."),
  isActive: z.boolean().default(true),
});

export type UserInput = z.infer<typeof userSchema>;

export const createUserSchema = userSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
