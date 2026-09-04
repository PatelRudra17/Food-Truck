"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { labourSchema } from "@/lib/validators/labour";

/** Master-data code — sequential, not via the transactional nextDocumentNumber sequence. */
async function nextLabourCode(): Promise<string> {
  const count = await prisma.labour.count();
  return `LAB-${String(count + 1).padStart(3, "0")}`;
}

export async function createLabourAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("LABOUR_CREATE");
    const data = labourSchema.parse(input);

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
      if (!shift) return { ok: false, error: "Selected shift not found." };
    }

    const labourCode = await nextLabourCode();

    const created = await prisma.labour.create({
      data: {
        labourCode,
        name: data.name,
        mobile: data.mobile,
        workType: data.workType ?? null,
        dailyWage: data.dailyWage,
        shiftId: data.shiftId ?? null,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Labour",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/labour");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateLabourAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("LABOUR_EDIT");
    const data = labourSchema.parse(input);

    const existing = await prisma.labour.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Labour record not found." };

    if (data.shiftId) {
      const shift = await prisma.shift.findUnique({ where: { id: data.shiftId } });
      if (!shift) return { ok: false, error: "Selected shift not found." };
    }

    const updated = await prisma.labour.update({
      where: { id },
      data: {
        name: data.name,
        mobile: data.mobile,
        workType: data.workType ?? null,
        dailyWage: data.dailyWage,
        shiftId: data.shiftId ?? null,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Labour",
      entityId: updated.id,
      oldValues: {
        name: existing.name,
        mobile: existing.mobile,
        workType: existing.workType,
        dailyWage: Number(existing.dailyWage),
        status: existing.status,
      },
      newValues: data,
    });

    revalidatePath("/labour");
    revalidatePath(`/labour/${id}`);
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveLabourAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("LABOUR_ARCHIVE");
    const existing = await prisma.labour.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Labour record not found." };

    await prisma.labour.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Labour",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/labour");
    revalidatePath(`/labour/${id}`);
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
