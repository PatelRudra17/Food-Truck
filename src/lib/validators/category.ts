import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  parentId: z.string().min(1).nullable().optional(),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable(),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;
