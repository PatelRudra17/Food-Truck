import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  SESSION_COOKIE_NAME: z.string().default("eils_session"),
  SESSION_TTL_HOURS: z.coerce.number().default(12),
  DOCUMENT_ENCRYPTION_KEY: z
    .string()
    .length(64, "DOCUMENT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_REGION: z.string().default("us-east-1"),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  STORAGE_SIGNED_URL_TTL: z.coerce.number().default(300),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  ALLOW_NEGATIVE_STOCK: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  RATE_LIMIT_LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),
  RATE_LIMIT_LOGIN_WINDOW_MINUTES: z.coerce.number().default(15),
});

export const env = envSchema.parse(process.env);
