import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""));

export const customerSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  contactPerson: optionalString(200),
  phone: optionalString(30),
  email: z.union([z.literal(""), z.string().email("Invalid email address")]).optional(),
  address: optionalString(500),
  location: optionalString(200),
  gstNumber: optionalString(20),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
