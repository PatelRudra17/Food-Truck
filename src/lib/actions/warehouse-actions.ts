"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { warehouseSchema, locationSchema } from "@/lib/validators/warehouse";

export async function createWarehouseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WAREHOUSE_CREATE");
    const data = warehouseSchema.parse(input);

    const existingCode = await prisma.warehouse.findUnique({ where: { code: data.code } });
    if (existingCode) throw new Error(`Warehouse code "${data.code}" is already in use.`);

    const created = await prisma.warehouse.create({
      data: {
        code: data.code,
        name: data.name,
        address: data.address,
        managerId: data.managerId || null,
        contact: data.contact,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Warehouse",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/warehouses");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateWarehouseAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WAREHOUSE_EDIT");
    const data = warehouseSchema.parse(input);

    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new Error("Warehouse not found.");

    if (data.code !== existing.code) {
      const codeInUse = await prisma.warehouse.findUnique({ where: { code: data.code } });
      if (codeInUse) throw new Error(`Warehouse code "${data.code}" is already in use.`);
    }

    const updated = await prisma.warehouse.update({
      where: { id },
      data: {
        code: data.code,
        name: data.name,
        address: data.address,
        managerId: data.managerId || null,
        contact: data.contact,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Warehouse",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/warehouses");
    revalidatePath(`/warehouses/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveWarehouseAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WAREHOUSE_ARCHIVE");
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new Error("Warehouse not found.");

    await prisma.warehouse.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Warehouse",
      entityId: id,
      oldValues: existing,
    });

    revalidatePath("/warehouses");
    revalidatePath(`/warehouses/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreWarehouseAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WAREHOUSE_EDIT");
    const existing = await prisma.warehouse.findUnique({ where: { id } });
    if (!existing) throw new Error("Warehouse not found.");

    await prisma.warehouse.update({ where: { id }, data: { status: "ACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Warehouse",
      entityId: id,
      oldValues: existing,
      newValues: { status: "ACTIVE" },
    });

    revalidatePath("/warehouses");
    revalidatePath(`/warehouses/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function addLocationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WAREHOUSE_EDIT");
    const data = locationSchema.parse(input);

    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new Error("Warehouse not found.");

    const created = await prisma.location.create({
      data: {
        warehouseId: data.warehouseId,
        rack: data.rack,
        shelf: data.shelf,
        bin: data.bin,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Location",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath(`/warehouses/${data.warehouseId}`);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeLocationAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("WAREHOUSE_EDIT");
    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) throw new Error("Location not found.");

    const itemsHere = await prisma.item.count({ where: { locationId: id } });
    if (itemsHere > 0) {
      throw new Error(`Cannot remove this location — ${itemsHere} item(s) are still assigned to it. Reassign them first.`);
    }

    await prisma.location.delete({ where: { id } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Location",
      entityId: id,
      oldValues: existing,
    });

    revalidatePath(`/warehouses/${existing.warehouseId}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
