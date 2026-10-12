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

/** Same as optionalNumber, but rejects negative values (prices, stock levels). */
const optionalNonNegativeNumber = (label: string) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0, `${label} cannot be negative.`)])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const optionalNonNegativeInt = z
  .union([
    z.literal(""),
    z.null(),
    z.undefined(),
    z.coerce.number().int("Shelf life must be a whole number of days.").min(0, "Shelf life cannot be negative."),
  ])
  .optional()
  .transform((v) => (v === "" || v === null || v === undefined ? null : v));

type ItemRangeFields = {
  minStock: number;
  maxStock: number | null;
  storageMinTempC: number | null;
  storageMaxTempC: number | null;
};

/** Cross-field checks shared by the create and edit schemas. */
function refineItemRanges(d: ItemRangeFields, ctx: z.RefinementCtx) {
  if (d.maxStock !== null && d.maxStock < d.minStock) {
    ctx.addIssue({
      code: "custom",
      message: "Max stock cannot be less than min stock.",
      path: ["maxStock"],
    });
  }
  if (d.storageMinTempC !== null && d.storageMaxTempC !== null && d.storageMinTempC > d.storageMaxTempC) {
    ctx.addIssue({
      code: "custom",
      message: "Min temperature cannot be greater than max temperature.",
      path: ["storageMinTempC"],
    });
  }
}

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
    minStock: z.coerce.number().min(0, "Min stock cannot be negative.").default(0),
    maxStock: optionalNonNegativeNumber("Max stock"),
    reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative.").default(0),
    warehouseId: optionalId,
    locationId: optionalId,
    supplierId: optionalId,
    purchasePrice: optionalNonNegativeNumber("Purchase price"),
    taxPercent: z.coerce
      .number()
      .min(0, "Tax % cannot be negative.")
      .max(100, "Tax % cannot exceed 100.")
      .optional()
      .nullable(),
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
    shelfLifeDays: optionalNonNegativeInt,
  })
  .refine((d) => !d.locationId || d.warehouseId, {
    message: "Select a warehouse before choosing a location.",
    path: ["locationId"],
  })
  .superRefine(refineItemRanges);

export const createItemSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required.").max(60),
    itemCode: z.string().trim().min(1, "Item code is required.").max(60),
    name: z.string().trim().min(1, "Name is required.").max(200),
    categoryId: z.string().min(1, "Category is required."),
    brand: optionalText(120),
    description: optionalText(2000),
    unit: z.string().trim().min(1, "Unit is required.").max(30),
    minStock: z.coerce.number().min(0, "Min stock cannot be negative.").default(0),
    maxStock: optionalNonNegativeNumber("Max stock"),
    reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative.").default(0),
    openingStock: z.coerce.number().min(0).default(0),
    warehouseId: optionalId,
    locationId: optionalId,
    supplierId: optionalId,
    purchasePrice: optionalNonNegativeNumber("Purchase price"),
    taxPercent: z.coerce
      .number()
      .min(0, "Tax % cannot be negative.")
      .max(100, "Tax % cannot exceed 100.")
      .optional()
      .nullable(),
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
    shelfLifeDays: optionalNonNegativeInt,
  })
  .refine((d) => !d.locationId || d.warehouseId, {
    message: "Select a warehouse before choosing a location.",
    path: ["locationId"],
  })
  .refine((d) => d.openingStock <= 0 || !!d.warehouseId, {
    message: "A warehouse is required to post an opening stock balance.",
    path: ["warehouseId"],
  })
  .superRefine(refineItemRanges);

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
    minStock: z.coerce.number().min(0, "minStock cannot be negative").optional(),
    maxStock: z.coerce.number().min(0, "maxStock cannot be negative").optional(),
    reorderLevel: z.coerce.number().min(0, "reorderLevel cannot be negative").optional(),
    openingStock: z.coerce.number().min(0, "openingStock cannot be negative").optional(),
    warehouseCode: z.string().trim().optional().or(z.literal("")),
    purchasePrice: z.coerce.number().min(0, "purchasePrice cannot be negative").optional(),
    taxPercent: z.coerce
      .number()
      .min(0, "taxPercent cannot be negative")
      .max(100, "taxPercent cannot exceed 100")
      .optional(),
    hsnCode: z.string().trim().optional().or(z.literal("")),
    barcode: z.string().trim().optional().or(z.literal("")),
  })
  .refine((d) => !!d.categoryId || !!d.categoryName, {
    message: "Either categoryId or categoryName must be provided.",
    path: ["categoryName"],
  })
  .refine((d) => d.maxStock === undefined || d.maxStock >= (d.minStock ?? 0), {
    message: "maxStock cannot be less than minStock.",
    path: ["maxStock"],
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
