"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { notifyUser } from "@/lib/services/notifications";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import {
  DEFAULT_CHECKLIST_LABELS,
  nextDayPreparationSchema,
  updatePreparationRemarksSchema,
  assignChecklistItemSchema,
  checklistRemarkSchema,
  reopenChecklistItemSchema,
} from "@/lib/validators/next-day-prep";

const NEXT_DAY_PATH = "/operations/next-day";

export async function createNextDayPreparationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_CREATE");
    const data = nextDayPreparationSchema.parse(input);

    const date = new Date(`${data.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");

    const existing = await prisma.nextDayPreparation.findUnique({ where: { date } });
    if (existing) throw new Error("A preparation checklist for this date already exists.");

    let createdId: string;
    try {
      const created = await prisma.$transaction(async (tx) => {
        const prep = await tx.nextDayPreparation.create({
          data: {
            date,
            createdById: user.id,
            remarks: data.remarks.trim() || null,
          },
        });

        await tx.nextDayChecklistItem.createMany({
          data: DEFAULT_CHECKLIST_LABELS.map((label) => ({ preparationId: prep.id, label })),
        });

        return prep;
      });
      createdId = created.id;
    } catch (txError) {
      if (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === "P2002") {
        throw new Error("A preparation checklist for this date already exists.");
      }
      throw txError;
    }

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "NextDayPreparation",
      entityId: createdId,
      newValues: data,
    });

    revalidatePath(NEXT_DAY_PATH);
    return { ok: true, data: { id: createdId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updatePreparationRemarksAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = updatePreparationRemarksSchema.parse(input);

    const existing = await prisma.nextDayPreparation.findUnique({ where: { id: data.id } });
    if (!existing) throw new Error("Preparation not found.");

    const updated = await prisma.nextDayPreparation.update({
      where: { id: data.id },
      data: { remarks: data.remarks.trim() || null },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "NextDayPreparation",
      entityId: data.id,
      oldValues: { remarks: existing.remarks },
      newValues: { remarks: updated.remarks },
    });

    revalidatePath(NEXT_DAY_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function assignChecklistItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = assignChecklistItemSchema.parse(input);

    const existing = await prisma.nextDayChecklistItem.findUnique({ where: { id: data.itemId } });
    if (!existing) throw new Error("Checklist item not found.");

    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!assignee) throw new Error("Selected person not found.");

    const nextStatus = existing.status === "PENDING" || existing.status === "REOPENED" ? "ASSIGNED" : existing.status;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.nextDayChecklistItem.update({
        where: { id: data.itemId },
        data: { assignedToId: data.assignedToId, status: nextStatus },
      });
      await notifyUser(tx, {
        userId: data.assignedToId,
        type: "SYSTEM_ALERT",
        title: "Next-day preparation task assigned",
        message: `You have been assigned: "${existing.label}".`,
        entityType: "NextDayChecklistItem",
        entityId: item.id,
      });
      return item;
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "NextDayChecklistItem",
      entityId: data.itemId,
      oldValues: { assignedToId: existing.assignedToId, status: existing.status },
      newValues: { assignedToId: updated.assignedToId, status: updated.status },
    });

    revalidatePath(NEXT_DAY_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function completeChecklistItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = checklistRemarkSchema.parse(input);

    const existing = await prisma.nextDayChecklistItem.findUnique({ where: { id: data.itemId } });
    if (!existing) throw new Error("Checklist item not found.");
    if (existing.status === "COMPLETE") throw new Error("This item is already complete.");

    const updated = await prisma.nextDayChecklistItem.update({
      where: { id: data.itemId },
      data: {
        status: "COMPLETE",
        remark: data.remark.trim() || existing.remark,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "NextDayChecklistItem",
      entityId: data.itemId,
      oldValues: { status: existing.status, remark: existing.remark },
      newValues: { status: updated.status, remark: updated.remark },
    });

    revalidatePath(NEXT_DAY_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reopenChecklistItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = reopenChecklistItemSchema.parse(input);

    const existing = await prisma.nextDayChecklistItem.findUnique({ where: { id: data.itemId } });
    if (!existing) throw new Error("Checklist item not found.");
    if (existing.status !== "COMPLETE") throw new Error("Only a completed item can be reopened.");

    const updated = await prisma.nextDayChecklistItem.update({
      where: { id: data.itemId },
      data: { status: "REOPENED", remark: data.reason.trim() },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "NextDayChecklistItem",
      entityId: data.itemId,
      oldValues: { status: existing.status, remark: existing.remark },
      newValues: { status: updated.status, remark: updated.remark },
    });

    revalidatePath(NEXT_DAY_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function addChecklistRemarkAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("OPERATIONS_EDIT");
    const data = checklistRemarkSchema.parse(input);

    const existing = await prisma.nextDayChecklistItem.findUnique({ where: { id: data.itemId } });
    if (!existing) throw new Error("Checklist item not found.");

    const updated = await prisma.nextDayChecklistItem.update({
      where: { id: data.itemId },
      data: { remark: data.remark.trim() || null },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "NextDayChecklistItem",
      entityId: data.itemId,
      oldValues: { remark: existing.remark },
      newValues: { remark: updated.remark },
    });

    revalidatePath(NEXT_DAY_PATH);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
