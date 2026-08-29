import crypto from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const key = Buffer.from(env.DOCUMENT_ENCRYPTION_KEY, "hex");

/**
 * Encrypts a plaintext identity number (Aadhaar/PAN/Licence) for at-rest storage.
 * Returns iv:authTag:ciphertext, all hex-encoded, joined so it fits a single text column.
 */
export function encryptSensitive(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptSensitive(payload: string): string {
  const [ivHex, authTagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted payload");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

/** Masks an Aadhaar number as "XXXX XXXX 4821". Accepts digits with or without spaces. */
export function maskAadhaar(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, "");
  const last4 = digits.slice(-4).padStart(4, "X");
  return `XXXX XXXX ${last4}`;
}

/** Masks a PAN as "XXXXX4821X" (last 5 chars visible, matching PAN's checksum-letter format). */
export function maskPAN(pan: string): string {
  const clean = pan.trim().toUpperCase();
  if (clean.length < 5) return "X".repeat(clean.length);
  const visible = clean.slice(-5);
  return "X".repeat(clean.length - 5) + visible;
}

/** Masks a driving licence number, revealing only the last 4 characters. */
export function maskLicence(licence: string): string {
  const clean = licence.trim().toUpperCase();
  if (clean.length <= 4) return "X".repeat(clean.length);
  return "X".repeat(clean.length - 4) + clean.slice(-4);
}

export function maskForDocType(
  docType: "AADHAAR" | "PAN" | "DRIVING_LICENCE" | string,
  value: string,
): string {
  switch (docType) {
    case "AADHAAR":
      return maskAadhaar(value);
    case "PAN":
      return maskPAN(value);
    case "DRIVING_LICENCE":
      return maskLicence(value);
    default:
      return value.length > 4 ? "X".repeat(value.length - 4) + value.slice(-4) : value;
  }
}

/** Generates a secure random token for session identifiers, hashed before DB storage. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
