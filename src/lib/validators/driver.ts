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

/** Digits with optional leading +, spaces and dashes; 10–15 digits in total. */
export function isValidPhone(value: string): boolean {
  if (!/^\+?[\d\s-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 10 && digits <= 15;
}

/**
 * Canonical form of an identity number before validation/encryption:
 * Aadhaar drops spaces/dashes ("1234 5678 9012"), PAN/DL are uppercased.
 */
export function normalizeDocNumber(docType: string, value: string): string {
  switch (docType) {
    case "AADHAAR":
      return value.replace(/[\s-]/g, "");
    case "PAN":
      return value.replace(/\s/g, "").toUpperCase();
    case "DRIVING_LICENCE":
      return value.trim().replace(/\s+/g, " ").toUpperCase();
    default:
      return value;
  }
}

/** Returns an error message when the number doesn't match the doc type's format. */
export function docNumberFormatError(docType: string, value: string): string | null {
  switch (docType) {
    case "AADHAAR":
      return /^\d{12}$/.test(value) ? null : "Aadhaar number must be 12 digits.";
    case "PAN":
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(value) ? null : "PAN must be in the format AAAAA9999A.";
    case "DRIVING_LICENCE":
      return /^[A-Z0-9][A-Z0-9 -]{6,18}[A-Z0-9]$/.test(value)
        ? null
        : "Driving licence number must be 8–20 letters/digits (spaces and dashes allowed).";
    default:
      return null;
  }
}

/**
 * Kept to the minimum fields already in the Driver schema — no extra personal
 * data fields are collected beyond what's here.
 */
export const driverSchema = z.object({
  employeeId: optionalText,
  fullName: z.string().trim().min(2, "Full name is required"),
  mobile: z
    .string()
    .trim()
    .min(1, "Mobile number is required")
    .refine(isValidPhone, "Enter a valid phone number (10–15 digits; +, spaces and dashes allowed)."),
  altMobile: optionalText.refine(
    (v) => v === undefined || isValidPhone(v),
    "Enter a valid phone number (10–15 digits; +, spaces and dashes allowed).",
  ),
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
export const driverDocumentSchema = z
  .object({
    driverId: z.string().min(1),
    docType: z.enum(DRIVER_DOC_TYPES),
    plainNumber: optionalText,
    licenceClass: optionalText,
    issueDate: optionalDate,
    expiryDate: optionalDate,
    issuingAuthority: optionalText,
    verificationStatus: z.enum(VERIFICATION_STATUSES),
  })
  .superRefine((d, ctx) => {
    if (d.plainNumber) {
      const error = docNumberFormatError(d.docType, normalizeDocNumber(d.docType, d.plainNumber));
      if (error) ctx.addIssue({ code: "custom", message: error, path: ["plainNumber"] });
    }
    if (d.issueDate && d.expiryDate && d.expiryDate < d.issueDate) {
      ctx.addIssue({ code: "custom", message: "Expiry date cannot be before the issue date.", path: ["expiryDate"] });
    }
  })
  .transform((d) => ({
    ...d,
    plainNumber: d.plainNumber ? normalizeDocNumber(d.docType, d.plainNumber) : undefined,
  }));

export type DriverDocumentInput = z.infer<typeof driverDocumentSchema>;
