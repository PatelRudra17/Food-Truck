"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { systemSettingsSchema, SETTING_KEYS } from "@/lib/validators/settings";
import { validateUpload, uploadObject } from "@/lib/storage";

export async function saveSystemSettingsAction(input: unknown): Promise<ActionResult<undefined>> {
  try {
    const actor = await requirePermission("MANAGE_SETTINGS");
    const data = systemSettingsSchema.parse(input);

    const entries: [string, unknown][] = [
      [SETTING_KEYS.COMPANY_NAME, data.companyName],
      [SETTING_KEYS.CURRENCY, data.currency],
      [SETTING_KEYS.DATE_FORMAT, data.dateFormat],
      [SETTING_KEYS.TIME_ZONE, data.timeZone],
      [SETTING_KEYS.ALLOW_NEGATIVE_STOCK, data.allowNegativeStock],
      [SETTING_KEYS.DOCUMENT_EXPIRY_WARNING_DAYS, data.documentExpiryWarningDays],
      [SETTING_KEYS.HIGH_WASTAGE_THRESHOLD_PERCENT, data.highWastageThresholdPercent],
      [SETTING_KEYS.CRATE_OVERDUE_THRESHOLD_DAYS, data.crateOverdueThresholdDays],
    ];

    const existingRows = await prisma.systemSetting.findMany({
      where: { key: { in: entries.map(([k]) => k) } },
    });
    const oldValues: Record<string, unknown> = {};
    for (const row of existingRows) oldValues[row.key] = row.value;

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: value as never, updatedById: actor.id },
          update: { value: value as never, updatedById: actor.id },
        }),
      ),
    );

    await writeAuditLog({
      userId: actor.id,
      action: "SETTINGS_CHANGE",
      entityType: "SystemSetting",
      oldValues,
      newValues: Object.fromEntries(entries),
    });

    revalidatePath("/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadCompanyLogoAction(formData: FormData): Promise<ActionResult<{ storageKey: string }>> {
  try {
    const actor = await requirePermission("MANAGE_SETTINGS");
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) throw new Error("Please choose an image file to upload.");

    validateUpload({ type: file.type, size: file.size });
    const buffer = Buffer.from(await file.arrayBuffer());
    const { storageKey } = await uploadObject({
      buffer,
      mimeType: file.type,
      entityType: "SystemSetting",
      originalFileName: file.name,
    });

    const existing = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEYS.COMPANY_LOGO_STORAGE_KEY },
    });

    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEYS.COMPANY_LOGO_STORAGE_KEY },
      create: { key: SETTING_KEYS.COMPANY_LOGO_STORAGE_KEY, value: storageKey, updatedById: actor.id },
      update: { value: storageKey, updatedById: actor.id },
    });

    await writeAuditLog({
      userId: actor.id,
      action: "SETTINGS_CHANGE",
      entityType: "SystemSetting",
      entityId: SETTING_KEYS.COMPANY_LOGO_STORAGE_KEY,
      oldValues: { COMPANY_LOGO_STORAGE_KEY: existing?.value ?? null },
      newValues: { COMPANY_LOGO_STORAGE_KEY: storageKey },
    });

    revalidatePath("/settings");
    return { ok: true, data: { storageKey } };
  } catch (error) {
    return actionError(error);
  }
}
