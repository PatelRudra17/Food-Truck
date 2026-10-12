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

// NOTE: union order matters — Number("") and Number(null) are both 0, so the blank
// branches must come BEFORE z.coerce.number() or a cleared field would save as 0.
const optionalNumber = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number({ error: "Enter a valid number." })])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const optionalInt = z
  .union([
    z.literal(""),
    z.null(),
    z.undefined(),
    z.coerce
      .number({ error: "Enter a valid number." })
      .int("Shelf life must be a whole number of days.")
      .min(0, "Shelf life cannot be negative."),
  ])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

export const TEMPERATURE_READING_MIN_C = -50;
export const TEMPERATURE_READING_MAX_C = 80;

/** Payload for recording one manual temperature reading. */
export const temperatureLogSchema = z.object({
  itemId: z.string().min(1, "Item is required."),
  batchNumber: optionalText(60),
  warehouseId: z.string().min(1, "Warehouse is required."),
  locationId: optionalId,
  recordedTempC: z.coerce
    .number({ error: "Enter a valid temperature." })
    .min(
      TEMPERATURE_READING_MIN_C,
      `Temperature must be between ${TEMPERATURE_READING_MIN_C}°C and ${TEMPERATURE_READING_MAX_C}°C.`,
    )
    .max(
      TEMPERATURE_READING_MAX_C,
      `Temperature must be between ${TEMPERATURE_READING_MIN_C}°C and ${TEMPERATURE_READING_MAX_C}°C.`,
    ),
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
