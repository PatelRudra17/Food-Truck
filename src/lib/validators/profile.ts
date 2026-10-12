import { z } from "zod";
import { passwordSchema } from "@/lib/validators/user";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
