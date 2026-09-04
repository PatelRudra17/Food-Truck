"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { temperatureLogSchema, temperatureSettingsSchema } from "@/lib/validators/storage-temperature";
import { computeTemperatureStatus } from "@/lib/services/temperature";
import { notifyRoleByName } from "@/lib/services/notifications";

/**
 * Records one manual temperature reading, computes its NORMAL/WARNING/CRITICAL
 * status from the item's configured range, and alerts Store Manager on a
 * WARNING/CRITICAL reading. `source` is always MANUAL from this UI — SENSOR is
 * reserved for a future hardware integration.
 */
export async function recordTemperatureLogAction(
  input: unknown,
): Promise<ActionResult<{ id: string; status: string }>> {
  try {
    const user = await requirePermission("STORAGE_TEMPERATURE_CREATE");
    const data = temperatureLogSchema.parse(input);

    const item = await prisma.item.findUnique({ where: { id: data.itemId } });
    if (!item) throw new Error("Item not found.");

    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new Error("Warehouse not found.");

    if (data.locationId) {
      const location = await prisma.location.findUnique({ where: { id: data.locationId } });
      if (!location || location.warehouseId !== data.warehouseId) {
        throw new Error("Selected location does not belong to the chosen warehouse.");
      }
    }

    const status = computeTemperatureStatus(item.storageMinTempC, item.storageMaxTempC, data.recordedTempC);

    const created = await prisma.storageTemperatureLog.create({
      data: {
        itemId: data.itemId,
        batchNumber: data.batchNumber,
        warehouseId: data.warehouseId,
        locationId: data.locationId,
        recordedTempC: data.recordedTempC,
        recordedById: user.id,
        status,
        source: "MANUAL",
        remarks: data.remarks,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "StorageTemperatureLog",
      entityId: created.id,
      newValues: { ...data, status },
    });

    if (status === "WARNING" || status === "CRITICAL") {
      const rangeText =
        item.storageMinTempC != null && item.storageMaxTempC != null
          ? `${Number(item.storageMinTempC)}–${Number(item.storageMaxTempC)}°C`
          : "its configured range";
      await notifyRoleByName("Store Manager", {
        type: "TEMPERATURE_ALERT",
        title: `${status === "CRITICAL" ? "Critical" : "Warning"} temperature — ${item.name}`,
        message: `${item.name}${data.batchNumber ? ` (batch ${data.batchNumber})` : ""} recorded at ${data.recordedTempC}°C in ${warehouse.name}, outside ${rangeText}.`,
        entityType: "StorageTemperatureLog",
        entityId: created.id,
      });
    }

    revalidatePath("/storage-temperature");
    revalidatePath(`/storage-temperature/${data.itemId}`);
    return { ok: true, data: { id: created.id, status } };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Minimal "Temperature Settings" editor for an item, gated by ITEM_EDIT (the
 * same permission the Item Master module's own edit form uses). Only touches
 * the plan2 temperature-configuration fields on Item — never restructures the
 * rest of that module.
 */
export async function updateItemTemperatureSettingsAction(
  itemId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ITEM_EDIT");
    const data = temperatureSettingsSchema.parse(input);

    const existing = await prisma.item.findUnique({ where: { id: itemId } });
    if (!existing) throw new Error("Item not found.");

    const updated = await prisma.item.update({
      where: { id: itemId },
      data: {
        isTemperatureSensitive: data.isTemperatureSensitive,
        storageMinTempC: data.storageMinTempC,
        storageMaxTempC: data.storageMaxTempC,
        storageType: data.storageType,
        shelfLifeDays: data.shelfLifeDays,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Item",
      entityId: itemId,
      oldValues: {
        isTemperatureSensitive: existing.isTemperatureSensitive,
        storageMinTempC: existing.storageMinTempC,
        storageMaxTempC: existing.storageMaxTempC,
        storageType: existing.storageType,
        shelfLifeDays: existing.shelfLifeDays,
      },
      newValues: data,
    });

    revalidatePath("/storage-temperature");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
