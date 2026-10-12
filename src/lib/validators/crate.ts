import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null))
    .nullable();

const optionalId = z
  .string()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : null))
  .nullable();

export const CRATE_STATUS_OPTIONS = [
  "AVAILABLE",
  "LOADED",
  "WITH_CUSTOMER",
  "RETURNED",
  "DAMAGED",
  "MISSING",
  "CLEANING",
  "READY",
] as const;

/** Create/edit form for the crate master record itself — never touches `status`. */
export const crateSchema = z.object({
  crateType: z.string().trim().min(1, "Crate type is required.").max(100),
  capacity: optionalText(50),
  currentLocation: optionalText(200),
  customerId: optionalId,
  condition: optionalText(200),
});
export type CrateInput = z.infer<typeof crateSchema>;

/** Dedicated status-transition action — always requires a reason, per the
 * "confirmation dialogs require a reason for important actions" convention. */
export const crateStatusChangeSchema = z.object({
  status: z.enum(CRATE_STATUS_OPTIONS),
  reason: z.string().trim().min(3, "A reason is required.").max(500),
});
export type CrateStatusChangeInput = z.infer<typeof crateStatusChangeSchema>;

/** Bulk "Mark cleaned": CLEANING → AVAILABLE. Without `ids`, every crate currently in CLEANING. */
export const markCratesCleanedSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(1000).optional(),
});
