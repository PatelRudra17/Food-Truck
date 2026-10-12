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
  REQUIRE_SEPARATE_APPROVER: "REQUIRE_SEPARATE_APPROVER",
} as const;

export const SELF_APPROVAL_MESSAGE = "You can't approve your own request.";

/** True when the approver is the person who created or submitted the request. */
export function isSelfApproval(approverId: string, requesterIds: readonly (string | null | undefined)[]): boolean {
  return requesterIds.some((id) => !!id && id === approverId);
}

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
  requireSeparateApprover: z.boolean().default(false),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;
