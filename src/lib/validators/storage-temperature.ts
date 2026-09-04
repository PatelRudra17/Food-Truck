import { z } from "zod";

export const STORAGE_TYPES = [
  "AMBIENT",
  "COLD_ROOM",
  "FROZEN",
  "DRY_STORAGE",
  "CONTROLLED_ATMOSPHERE",
  "OTHER",
] as const;

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

const optionalNumber = z
  .union([z.coerce.number(), z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const optionalInt = z
  .union([z.coerce.number().int(), z.literal(""), z.null(), z.undefined()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

/** Payload for recording one manual temperature reading. */
export const temperatureLogSchema = z.object({
  itemId: z.string().min(1, "Item is required."),
  batchNumber: optionalText(60),
  warehouseId: z.string().min(1, "Warehouse is required."),
  locationId: optionalId,
  recordedTempC: z.coerce.number().min(-50, "Out of range.").max(80, "Out of range."),
  remarks: optionalText(500),
});

export type TemperatureLogInput = z.infer<typeof temperatureLogSchema>;

/** Minimal "Temperature Settings" payload — only the fields this module is allowed to edit on Item. */
export const temperatureSettingsSchema = z
  .object({
    isTemperatureSensitive: z.boolean().default(true),
    storageMinTempC: optionalNumber,
    storageMaxTempC: optionalNumber,
    storageType: z.enum(STORAGE_TYPES).optional().nullable(),
    shelfLifeDays: optionalInt,
  })
  .refine(
    (d) => d.storageMinTempC == null || d.storageMaxTempC == null || d.storageMinTempC <= d.storageMaxTempC,
    { message: "Minimum temperature must not exceed the maximum.", path: ["storageMaxTempC"] },
  );

export type TemperatureSettingsInput = z.infer<typeof temperatureSettingsSchema>;

/** Filters accepted by the log list, export route and print view — all optional. */
export const temperatureLogFilterSchema = z.object({
  warehouseId: z.string().optional(),
  locationId: z.string().optional(),
  itemId: z.string().optional(),
  batchNumber: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type TemperatureLogFilters = z.infer<typeof temperatureLogFilterSchema>;
