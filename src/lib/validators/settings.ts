import { z } from "zod";

export const DATE_FORMAT_OPTIONS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"] as const;

export const SETTING_KEYS = {
  COMPANY_NAME: "COMPANY_NAME",
  CURRENCY: "CURRENCY",
  DATE_FORMAT: "DATE_FORMAT",
  TIME_ZONE: "TIME_ZONE",
  ALLOW_NEGATIVE_STOCK: "ALLOW_NEGATIVE_STOCK",
  DOCUMENT_EXPIRY_WARNING_DAYS: "DOCUMENT_EXPIRY_WARNING_DAYS",
  COMPANY_LOGO_STORAGE_KEY: "COMPANY_LOGO_STORAGE_KEY",
  HIGH_WASTAGE_THRESHOLD_PERCENT: "HIGH_WASTAGE_THRESHOLD_PERCENT",
  CRATE_OVERDUE_THRESHOLD_DAYS: "CRATE_OVERDUE_THRESHOLD_DAYS",
} as const;

export const systemSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required.").max(200),
  currency: z.string().trim().min(1, "Currency is required.").max(10),
  dateFormat: z.string().trim().min(1, "Date format is required."),
  timeZone: z.string().trim().min(1, "Time zone is required.").max(100),
  allowNegativeStock: z.boolean(),
  documentExpiryWarningDays: z
    .array(z.coerce.number().int().min(1).max(365))
    .min(1, "Add at least one day threshold."),
  highWastageThresholdPercent: z.coerce.number().min(1).max(100),
  crateOverdueThresholdDays: z.coerce.number().int().min(1).max(90),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
