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

// NOTE: union order matters here — Number("") and Number(null) both evaluate to 0,
// so the empty/null branches must be checked BEFORE z.coerce.number() or every
// blank optional numeric field would silently become 0 instead of null.
// `label` gives each field a friendly message instead of Zod's raw
// "Too small: expected number to be >=0".
const optionalNumber = (label: string) =>
  z
    .union(
      [
        z.literal(""),
        z.null(),
        z.undefined(),
        z.coerce
          .number({ message: `${label} must be a number.` })
          .nonnegative(`${label} cannot be negative.`),
      ],
      // Used when Zod can't attribute the failure to one branch (e.g. "abc").
      { error: `${label} must be a number of 0 or more.` },
    )
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const optionalInt = (label: string) =>
  z
    .union(
      [
        z.literal(""),
        z.null(),
        z.undefined(),
        z.coerce
          .number({ message: `${label} must be a number.` })
          .int(`${label} must be a whole number.`)
          .nonnegative(`${label} cannot be negative.`),
      ],
      { error: `${label} must be a whole number of 0 or more.` },
    )
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

export const ROUTE_STATUS_OPTIONS = ["ACTIVE", "INACTIVE"] as const;

export const routeClusterSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  description: optionalText(500),
  status: z.enum(ROUTE_STATUS_OPTIONS).default("ACTIVE"),
});
export type RouteClusterInput = z.infer<typeof routeClusterSchema>;

export const routeSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(150),
  startLocation: z
    .string()
    .trim()
    .min(1, "Start location is required.")
    .max(200),
  destination: z.string().trim().min(1, "Destination is required.").max(200),
  routeClusterId: optionalId,
  estimatedDistanceKm: optionalNumber("Estimated distance"),
  estimatedTimeMinutes: optionalInt("Estimated time"),
  status: z.enum(ROUTE_STATUS_OPTIONS).default("ACTIVE"),
});
export type RouteInput = z.infer<typeof routeSchema>;
