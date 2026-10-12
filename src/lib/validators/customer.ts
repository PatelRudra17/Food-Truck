import { z } from "zod";
import { isValidPhone } from "@/lib/validators/driver";

const optionalString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""));

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  contactPerson: optionalString(200),
  phone: optionalString(30).refine(
    (v) => !v || isValidPhone(v),
    "Enter a valid phone number (10–15 digits; +, spaces and dashes allowed).",
  ),
  email: z.union([z.literal(""), z.string().email("Invalid email address")]).optional(),
  address: optionalString(500),
  location: optionalString(200),
  gstNumber: optionalString(20),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type CustomerInput = z.infer<typeof customerSchema>;
