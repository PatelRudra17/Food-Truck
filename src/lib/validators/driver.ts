import { z } from "zod";

export const DRIVER_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;

export const DRIVER_DOC_TYPES = [
  "AADHAAR",
  "PAN",
  "DRIVING_LICENCE",
  "ADDRESS_PROOF",
  "MEDICAL_FITNESS",
  "POLICE_VERIFICATION",
  "TRAINING_CERTIFICATE",
  "OTHER",
] as const;

export const SENSITIVE_DRIVER_DOC_TYPES = ["AADHAAR", "PAN", "DRIVING_LICENCE"] as const;

export function isSensitiveDocType(docType: string): boolean {
  return (SENSITIVE_DRIVER_DOC_TYPES as readonly string[]).includes(docType);
}

export const VERIFICATION_STATUSES = ["UNVERIFIED", "VERIFIED", "REJECTED"] as const;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalDate = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/**
 * Kept to the minimum fields already in the Driver schema — no extra personal
 * data fields are collected beyond what's here.
 */
export const driverSchema = z.object({
  employeeId: optionalText,
  fullName: z.string().trim().min(2, "Full name is required"),
  mobile: z.string().trim().min(6, "Mobile number is required"),
  altMobile: optionalText,
  address: optionalText,
  dob: optionalDate,
  joiningDate: optionalDate,
  emergencyContact: optionalText,
  profilePhotoUrl: optionalText,
  status: z.enum(DRIVER_STATUSES),
});

export type DriverInput = z.infer<typeof driverSchema>;

/**
 * `plainNumber` is the raw identity number typed into the form. For
 * AADHAAR/PAN/DRIVING_LICENCE the server action immediately encrypts it
 * (encryptSensitive) and derives numberMasked (maskForDocType) — the plaintext
 * itself is NEVER persisted or logged. For non-sensitive doc types the value
 * (if any) is stored as-is in numberMasked; no encryption needed.
 * Left blank on edit, an existing sensitive number is left untouched.
 */
export const driverDocumentSchema = z.object({
  driverId: z.string().min(1),
  docType: z.enum(DRIVER_DOC_TYPES),
  plainNumber: optionalText,
  licenceClass: optionalText,
  issueDate: optionalDate,
  expiryDate: optionalDate,
  issuingAuthority: optionalText,
  verificationStatus: z.enum(VERIFICATION_STATUSES),
});

export type DriverDocumentInput = z.infer<typeof driverDocumentSchema>;
