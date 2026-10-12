"use server";

import { prisma } from "@/lib/prisma";
import { Prisma, LedgerTxnType } from "@prisma/client";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { createItemSchema, itemBaseSchema } from "@/lib/validators/item";
import { applyStockMovement } from "@/lib/services/inventory";
import type { z } from "zod";

/** Field-level messages from a failed parse, so the form shows "Max stock cannot be less than min stock." rather than raw Zod JSON. */
function validationFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: error.issues[0]?.message ?? "Please check the form and try again.", fieldErrors };
}

export async function createItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ITEM_CREATE");
    const parsed = createItemSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const [skuTaken, codeTaken, barcodeTaken] = await Promise.all([
      prisma.item.findUnique({ where: { sku: data.sku } }),
      prisma.item.findUnique({ where: { itemCode: data.itemCode } }),
      data.barcode ? prisma.item.findUnique({ where: { barcode: data.barcode } }) : null,
    ]);
    if (skuTaken) throw new Error(`SKU "${data.sku}" is already in use.`);
    if (codeTaken) throw new Error(`Item code "${data.itemCode}" is already in use.`);
    if (barcodeTaken) throw new Error(`Barcode "${data.barcode}" is already in use.`);

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Selected category was not found.");

    const created = await prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          sku: data.sku,
          itemCode: data.itemCode,
          name: data.name,
          categoryId: data.categoryId,
          brand: data.brand,
          description: data.description,
          unit: data.unit,
          minStock: data.minStock,
          maxStock: data.maxStock ?? null,
          reorderLevel: data.reorderLevel,
          openingStock: data.openingStock,
          currentStock: 0,
          warehouseId: data.warehouseId,
          locationId: data.locationId,
          supplierId: data.supplierId,
          purchasePrice: data.purchasePrice ?? null,
          taxPercent: data.taxPercent ?? null,
          hsnCode: data.hsnCode,
          barcode: data.barcode,
          batchTracked: data.batchTracked,
          serialTracked: data.serialTracked,
          expiryTracked: data.expiryTracked,
          imageUrl: data.imageUrl,
          isActive: data.isActive,
          isTemperatureSensitive: data.isTemperatureSensitive,
          storageMinTempC: data.storageMinTempC ?? null,
          storageMaxTempC: data.storageMaxTempC ?? null,
          storageType: data.storageType ?? null,
          storageLocationText: data.storageLocationText,
          shelfLifeDays: data.shelfLifeDays ?? null,
        },
      });

      if (data.openingStock > 0 && data.warehouseId) {
        await applyStockMovement(tx, {
          itemId: item.id,
          warehouseId: data.warehouseId,
          transactionType: LedgerTxnType.OPENING,
          quantity: data.openingStock,
          referenceType: "ITEM_OPENING_BALANCE",
          referenceId: item.id,
          referenceNumber: item.itemCode,
          userId: user.id,
          reason: "Opening stock",
        });
      }

      return item;
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Item",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/items");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateItemAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ITEM_EDIT");
    const parsed = itemBaseSchema.safeParse(input);
    if (!parsed.success) return validationFailure(parsed.error);
    const data = parsed.data;

    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw new Error("Item not found.");

    if (data.sku !== existing.sku) {
      const skuTaken = await prisma.item.findUnique({ where: { sku: data.sku } });
      if (skuTaken) throw new Error(`SKU "${data.sku}" is already in use.`);
    }
    if (data.itemCode !== existing.itemCode) {
      const codeTaken = await prisma.item.findUnique({ where: { itemCode: data.itemCode } });
      if (codeTaken) throw new Error(`Item code "${data.itemCode}" is already in use.`);
    }
    if (data.barcode && data.barcode !== existing.barcode) {
      const barcodeTaken = await prisma.item.findUnique({ where: { barcode: data.barcode } });
      if (barcodeTaken) throw new Error(`Barcode "${data.barcode}" is already in use.`);
    }

    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) throw new Error("Selected category was not found.");

    const updated = await prisma.item.update({
      where: { id },
      data: {
        sku: data.sku,
        itemCode: data.itemCode,
        name: data.name,
        categoryId: data.categoryId,
        brand: data.brand,
        description: data.description,
        unit: data.unit,
        minStock: data.minStock,
        maxStock: data.maxStock ?? null,
        reorderLevel: data.reorderLevel,
        // currentStock and openingStock are intentionally never touched here.
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        supplierId: data.supplierId,
        purchasePrice: data.purchasePrice ?? null,
        taxPercent: data.taxPercent ?? null,
        hsnCode: data.hsnCode,
        barcode: data.barcode,
        batchTracked: data.batchTracked,
        serialTracked: data.serialTracked,
        expiryTracked: data.expiryTracked,
        imageUrl: data.imageUrl,
        isActive: data.isActive,
        isTemperatureSensitive: data.isTemperatureSensitive,
        storageMinTempC: data.storageMinTempC ?? null,
        storageMaxTempC: data.storageMaxTempC ?? null,
        storageType: data.storageType ?? null,
        storageLocationText: data.storageLocationText,
        shelfLifeDays: data.shelfLifeDays ?? null,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Item",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/items");
    revalidatePath(`/items/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveItemAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ITEM_ARCHIVE");
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw new Error("Item not found.");

    await prisma.item.update({ where: { id }, data: { isActive: false } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Item",
      entityId: id,
      oldValues: existing,
    });

    revalidatePath("/items");
    revalidatePath(`/items/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreItemAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ITEM_EDIT");
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw new Error("Item not found.");

    await prisma.item.update({ where: { id }, data: { isActive: true } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Item",
      entityId: id,
      oldValues: existing,
      newValues: { isActive: true },
    });

    revalidatePath("/items");
    revalidatePath(`/items/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

function computeEan13CheckDigit(base12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(base12[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

function generateEan13(seed: string): string {
  let digits = "";
  for (const ch of seed) digits += (ch.charCodeAt(0) % 10).toString();
  const timePart = Date.now().toString();
  const randomPart = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  const base12 = (digits + timePart + randomPart).slice(0, 12).padEnd(12, "0");
  return base12 + computeEan13CheckDigit(base12).toString();
}

/** Generates missing qrCodePayload / barcode values for an item. Never overwrites values already set. */
export async function generateItemCodesAction(id: string): Promise<ActionResult<{ qrCodePayload: string; barcode: string }>> {
  try {
    const user = await requirePermission("ITEM_EDIT");
    const existing = await prisma.item.findUnique({ where: { id } });
    if (!existing) throw new Error("Item not found.");

    const qrCodePayload = existing.qrCodePayload || `ITEM:${existing.itemCode}`;
    let barcode = existing.barcode;

    if (!barcode) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateEan13(existing.itemCode + attempt);
        try {
          await prisma.item.update({ where: { id }, data: { barcode: candidate } });
          barcode = candidate;
          break;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            continue; // collision — retry with a new candidate
          }
          throw err;
        }
      }
      if (!barcode) throw new Error("Could not generate a unique barcode. Please try again.");
    }

    if (!existing.qrCodePayload) {
      await prisma.item.update({ where: { id }, data: { qrCodePayload } });
    }

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Item",
      entityId: id,
      newValues: { qrCodePayload, barcode },
    });

    revalidatePath(`/items/${id}`);
    return { ok: true, data: { qrCodePayload, barcode } };
  } catch (error) {
    return actionError(error);
  }
}
