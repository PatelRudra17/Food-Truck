import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""));

export const supplierSchema = z.object({
  code: z.string().min(1, "Code is required").max(50, "Code is too long"),
  companyName: z.string().min(1, "Company name is required").max(200),
  contactPerson: optionalString(200),
  phone: optionalString(30),
  email: z.union([z.literal(""), z.string().email("Invalid email address")]).optional(),
  address: optionalString(500),
  gstNumber: optionalString(20),
  panNumber: optionalString(20),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export type SupplierInput = z.infer<typeof supplierSchema>;
