import { describe, expect, it } from "vitest";
import {
  maskAadhaar,
  maskPAN,
  maskLicence,
  maskForDocType,
  encryptSensitive,
  decryptSensitive,
} from "@/lib/crypto";

// NOTE on env: importing "@/lib/crypto" transitively imports "@/lib/env",
// which eagerly zod-parses process.env (including DOCUMENT_ENCRYPTION_KEY,
// a 64-char hex string required for AES-256-GCM). vitest.config.ts loads the
// repo's local .env file via Node's built-in process.loadEnvFile() before any
// test file runs (mirroring the `tsx --env-file=.env` pattern the existing
// `npm run db:seed` script already uses), so this works under a plain
// `vitest run` with no DB connection and no Next.js runtime involved.

describe("maskAadhaar", () => {
  it("masks all but the last 4 digits, spaced like an Aadhaar number", () => {
    expect(maskAadhaar("123456784821")).toBe("XXXX XXXX 4821");
  });

  it("strips existing spaces before masking", () => {
    expect(maskAadhaar("1234 5678 4821")).toBe("XXXX XXXX 4821");
  });
});

describe("maskPAN", () => {
  it("reveals only the last 5 characters", () => {
    expect(maskPAN("ABCDE4821F")).toBe("XXXXX4821F");
  });

  it("uppercases before masking", () => {
    expect(maskPAN("abcde4821f")).toBe("XXXXX4821F");
  });

  it("masks entirely when shorter than 5 characters", () => {
    expect(maskPAN("AB12")).toBe("XXXX");
  });
});

describe("maskLicence", () => {
  it("reveals only the last 4 characters", () => {
    expect(maskLicence("mh1420230012345")).toBe("XXXXXXXXXXX2345");
  });

  it("masks entirely when 4 characters or fewer", () => {
    expect(maskLicence("MH14")).toBe("XXXX");
  });
});

describe("maskForDocType", () => {
  it("dispatches to maskAadhaar for AADHAAR", () => {
    expect(maskForDocType("AADHAAR", "123456784821")).toBe(maskAadhaar("123456784821"));
  });

  it("dispatches to maskPAN for PAN", () => {
    expect(maskForDocType("PAN", "ABCDE4821F")).toBe(maskPAN("ABCDE4821F"));
  });

  it("dispatches to maskLicence for DRIVING_LICENCE", () => {
    expect(maskForDocType("DRIVING_LICENCE", "MH1420230012345")).toBe(
      maskLicence("MH1420230012345"),
    );
  });

  it("falls back to a generic last-4 mask for an unknown doc type", () => {
    expect(maskForDocType("SOME_OTHER_DOC", "ABCDEFGH1234")).toBe("XXXXXXXX1234");
  });
});

describe("encryptSensitive / decryptSensitive round trip", () => {
  it("decrypts back to the original plaintext", () => {
    const plaintext = "123456784821";
    const encrypted = encryptSensitive(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptSensitive(encrypted)).toBe(plaintext);
  });

  it("produces a different ciphertext each time (random IV) but both still decrypt correctly", () => {
    const plaintext = "ABCDE4821F";
    const first = encryptSensitive(plaintext);
    const second = encryptSensitive(plaintext);
    expect(first).not.toBe(second);
    expect(decryptSensitive(first)).toBe(plaintext);
    expect(decryptSensitive(second)).toBe(plaintext);
  });

  it("throws on a malformed payload", () => {
    expect(() => decryptSensitive("not-a-valid-payload")).toThrow();
  });
});
