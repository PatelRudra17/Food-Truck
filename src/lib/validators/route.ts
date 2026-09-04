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
const optionalNumber = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().nonnegative()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const optionalInt = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int().nonnegative()])
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
  startLocation: z.string().trim().min(1, "Start location is required.").max(200),
  destination: z.string().trim().min(1, "Destination is required.").max(200),
  routeClusterId: optionalId,
  estimatedDistanceKm: optionalNumber,
  estimatedTimeMinutes: optionalInt,
  status: z.enum(ROUTE_STATUS_OPTIONS).default("ACTIVE"),
});
export type RouteInput = z.infer<typeof routeSchema>;
