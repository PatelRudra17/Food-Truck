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

// NOTE: union order matters here — Number("") and Number(null) both evaluate to 0,
// so the empty/null branches must be checked BEFORE z.coerce.number() or every
// blank optional numeric field would silently become 0 instead of null.
const optionalNumber = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const optionalInt = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int()])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

/** Shared fields for both create and edit. currentStock is intentionally NOT here — never directly editable. */
export const itemBaseSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required.").max(60),
    itemCode: z.string().trim().min(1, "Item code is required.").max(60),
    name: z.string().trim().min(1, "Name is required.").max(200),
    categoryId: z.string().min(1, "Category is required."),
    brand: optionalText(120),
    description: optionalText(2000),
    unit: z.string().trim().min(1, "Unit is required.").max(30),
    minStock: z.coerce.number().min(0).default(0),
    maxStock: optionalNumber,
    reorderLevel: z.coerce.number().min(0).default(0),
    warehouseId: optionalId,
    locationId: optionalId,
    supplierId: optionalId,
    purchasePrice: optionalNumber,
    taxPercent: z.coerce.number().min(0).max(100).optional().nullable(),
    hsnCode: optionalText(30),
    barcode: optionalText(60),
    batchTracked: z.boolean().default(false),
    serialTracked: z.boolean().default(false),
    expiryTracked: z.boolean().default(false),
    imageUrl: optionalText(1000),
    isActive: z.boolean().default(true),
    isTemperatureSensitive: z.boolean().default(false),
    storageMinTempC: optionalNumber,
    storageMaxTempC: optionalNumber,
    storageType: z.enum(STORAGE_TYPES).optional().nullable(),
    storageLocationText: optionalText(200),
    shelfLifeDays: optionalInt,
  })
  .refine((d) => !d.locationId || d.warehouseId, {
    message: "Select a warehouse before choosing a location.",
    path: ["locationId"],
  });

export const createItemSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required.").max(60),
    itemCode: z.string().trim().min(1, "Item code is required.").max(60),
    name: z.string().trim().min(1, "Name is required.").max(200),
    categoryId: z.string().min(1, "Category is required."),
    brand: optionalText(120),
    description: optionalText(2000),
    unit: z.string().trim().min(1, "Unit is required.").max(30),
    minStock: z.coerce.number().min(0).default(0),
    maxStock: optionalNumber,
    reorderLevel: z.coerce.number().min(0).default(0),
    openingStock: z.coerce.number().min(0).default(0),
    warehouseId: optionalId,
    locationId: optionalId,
    supplierId: optionalId,
    purchasePrice: optionalNumber,
    taxPercent: z.coerce.number().min(0).max(100).optional().nullable(),
    hsnCode: optionalText(30),
    barcode: optionalText(60),
    batchTracked: z.boolean().default(false),
    serialTracked: z.boolean().default(false),
    expiryTracked: z.boolean().default(false),
    imageUrl: optionalText(1000),
    isActive: z.boolean().default(true),
    isTemperatureSensitive: z.boolean().default(false),
    storageMinTempC: optionalNumber,
    storageMaxTempC: optionalNumber,
    storageType: z.enum(STORAGE_TYPES).optional().nullable(),
    storageLocationText: optionalText(200),
    shelfLifeDays: optionalInt,
  })
  .refine((d) => !d.locationId || d.warehouseId, {
    message: "Select a warehouse before choosing a location.",
    path: ["locationId"],
  })
  .refine((d) => d.openingStock <= 0 || !!d.warehouseId, {
    message: "A warehouse is required to post an opening stock balance.",
    path: ["warehouseId"],
  });

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof itemBaseSchema>;

/** One row of the bulk-import CSV. Numeric fields are coerced from strings. */
export const itemImportRowSchema = z
  .object({
    sku: z.string().trim().min(1, "sku is required"),
    itemCode: z.string().trim().min(1, "itemCode is required"),
    name: z.string().trim().min(1, "name is required"),
    categoryId: z.string().trim().optional().or(z.literal("")),
    categoryName: z.string().trim().optional().or(z.literal("")),
    unit: z.string().trim().min(1, "unit is required"),
    brand: z.string().trim().optional().or(z.literal("")),
    minStock: z.coerce.number().min(0).optional(),
    maxStock: z.coerce.number().min(0).optional(),
    reorderLevel: z.coerce.number().min(0).optional(),
    openingStock: z.coerce.number().min(0).optional(),
    warehouseCode: z.string().trim().optional().or(z.literal("")),
    purchasePrice: z.coerce.number().min(0).optional(),
    taxPercent: z.coerce.number().min(0).max(100).optional(),
    hsnCode: z.string().trim().optional().or(z.literal("")),
    barcode: z.string().trim().optional().or(z.literal("")),
  })
  .refine((d) => !!d.categoryId || !!d.categoryName, {
    message: "Either categoryId or categoryName must be provided.",
    path: ["categoryName"],
  });

export type ItemImportRow = z.infer<typeof itemImportRowSchema>;

export const ITEM_IMPORT_TEMPLATE_HEADERS = [
  "sku",
  "itemCode",
  "name",
  "categoryName",
  "unit",
  "brand",
  "minStock",
  "maxStock",
  "reorderLevel",
  "openingStock",
  "warehouseCode",
  "purchasePrice",
  "taxPercent",
  "hsnCode",
  "barcode",
] as const;
