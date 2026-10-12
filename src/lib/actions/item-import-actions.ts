"use server";

import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { LedgerTxnType } from "@prisma/client";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { itemImportRowSchema } from "@/lib/validators/item";
import { applyStockMovement } from "@/lib/services/inventory";

export type ImportFailure = { row: number; error: string };
export type BulkImportResult = { successCount: number; failures: ImportFailure[] };

const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMPORT_TYPES = ["text/csv", "application/vnd.ms-excel", "text/plain", ""];

export async function bulkImportItemsAction(formData: FormData): Promise<ActionResult<BulkImportResult>> {
  try {
    const user = await requirePermission("ITEM_CREATE");

    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file was uploaded.");
    if (file.size === 0) throw new Error("The uploaded file is empty.");
    if (file.size > MAX_IMPORT_BYTES) {
      throw new Error("The uploaded file exceeds the 5 MB import limit.");
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      throw new Error("Only .csv files are accepted for import.");
    }
    if (!ALLOWED_IMPORT_TYPES.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not accepted for import.`);
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      throw new Error(`Could not parse CSV: ${parsed.errors[0].message}`);
    }

    const failures: ImportFailure[] = [];
    let successCount = 0;

    // Cache lookups to avoid re-querying identical category/warehouse references across rows.
    const categoryByName = new Map<string, string | null>();
    const warehouseByCode = new Map<string, string | null>();

    for (let i = 0; i < parsed.data.length; i++) {
      const rowNumber = i + 2; // header is row 1
      const raw = parsed.data[i];

      try {
        const parsedRow = itemImportRowSchema.safeParse({
          sku: raw.sku,
          itemCode: raw.itemCode,
          name: raw.name,
          categoryId: raw.categoryId,
          categoryName: raw.categoryName,
          unit: raw.unit,
          brand: raw.brand,
          minStock: raw.minStock === "" || raw.minStock === undefined ? undefined : raw.minStock,
          maxStock: raw.maxStock === "" || raw.maxStock === undefined ? undefined : raw.maxStock,
          reorderLevel: raw.reorderLevel === "" || raw.reorderLevel === undefined ? undefined : raw.reorderLevel,
          openingStock: raw.openingStock === "" || raw.openingStock === undefined ? undefined : raw.openingStock,
          warehouseCode: raw.warehouseCode,
          purchasePrice: raw.purchasePrice === "" || raw.purchasePrice === undefined ? undefined : raw.purchasePrice,
          taxPercent: raw.taxPercent === "" || raw.taxPercent === undefined ? undefined : raw.taxPercent,
          hsnCode: raw.hsnCode,
          barcode: raw.barcode,
        });
        if (!parsedRow.success) {
          const issue = parsedRow.error.issues[0];
          const field = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
          throw new Error(`${field}${issue.message}`);
        }
        const row = parsedRow.data;

        // Resolve category
        let categoryId: string | null = row.categoryId || null;
        if (!categoryId && row.categoryName) {
          const key = row.categoryName.trim().toLowerCase();
          if (!categoryByName.has(key)) {
            const found = await prisma.category.findFirst({
              where: { name: { equals: row.categoryName.trim(), mode: "insensitive" } },
            });
            categoryByName.set(key, found?.id ?? null);
          }
          categoryId = categoryByName.get(key) ?? null;
        }
        if (!categoryId) {
          throw new Error(`Category not found: "${row.categoryId || row.categoryName}"`);
        }

        // Resolve warehouse (optional)
        let warehouseId: string | null = null;
        if (row.warehouseCode) {
          const key = row.warehouseCode.trim().toUpperCase();
          if (!warehouseByCode.has(key)) {
            const found = await prisma.warehouse.findUnique({ where: { code: row.warehouseCode.trim() } });
            warehouseByCode.set(key, found?.id ?? null);
          }
          warehouseId = warehouseByCode.get(key) ?? null;
          if (!warehouseId) throw new Error(`Warehouse code not found: "${row.warehouseCode}"`);
        }

        const openingStock = row.openingStock ?? 0;
        if (openingStock > 0 && !warehouseId) {
          throw new Error("A warehouseCode is required when openingStock is greater than zero.");
        }

        const [skuTaken, codeTaken] = await Promise.all([
          prisma.item.findUnique({ where: { sku: row.sku } }),
          prisma.item.findUnique({ where: { itemCode: row.itemCode } }),
        ]);
        if (skuTaken) throw new Error(`SKU "${row.sku}" already exists.`);
        if (codeTaken) throw new Error(`Item code "${row.itemCode}" already exists.`);
        if (row.barcode) {
          const barcodeTaken = await prisma.item.findUnique({ where: { barcode: row.barcode } });
          if (barcodeTaken) throw new Error(`Barcode "${row.barcode}" already exists.`);
        }

        // Each row's insert is its own atomic unit — a failure here never leaves a half-written row.
        await prisma.$transaction(async (tx) => {
          const item = await tx.item.create({
            data: {
              sku: row.sku,
              itemCode: row.itemCode,
              name: row.name,
              categoryId,
              brand: row.brand || null,
              unit: row.unit,
              minStock: row.minStock ?? 0,
              maxStock: row.maxStock ?? null,
              reorderLevel: row.reorderLevel ?? 0,
              openingStock,
              currentStock: 0,
              warehouseId,
              purchasePrice: row.purchasePrice ?? null,
              taxPercent: row.taxPercent ?? null,
              hsnCode: row.hsnCode || null,
              barcode: row.barcode || null,
            },
          });

          if (openingStock > 0 && warehouseId) {
            await applyStockMovement(tx, {
              itemId: item.id,
              warehouseId,
              transactionType: LedgerTxnType.OPENING,
              quantity: openingStock,
              referenceType: "ITEM_OPENING_BALANCE",
              referenceId: item.id,
              referenceNumber: item.itemCode,
              userId: user.id,
              reason: "Opening stock (bulk import)",
            });
          }
        });

        successCount++;
      } catch (rowError) {
        failures.push({
          row: rowNumber,
          error: rowError instanceof Error ? rowError.message : "Unknown error while importing this row.",
        });
      }
    }

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Item",
      newValues: { bulkImport: true, successCount, failureCount: failures.length },
    });

    revalidatePath("/items");
    return { ok: true, data: { successCount, failures } };
  } catch (error) {
    return actionError(error);
  }
}
