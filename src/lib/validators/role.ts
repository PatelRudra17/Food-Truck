import { z } from "zod";

export const roleSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable(),
});

export type RoleInput = z.infer<typeof roleSchema>;

export const savePermissionsSchema = z.object({
  roleId: z.string().min(1, "Role is required."),
  permissionCodes: z.array(z.string()),
});

export type SavePermissionsInput = z.infer<typeof savePermissionsSchema>;
