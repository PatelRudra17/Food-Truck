import { prisma } from "@/lib/prisma";
import { notifyRoleByName } from "@/lib/services/notifications";

/**
 * CRATE_OVERDUE has no natural state-transition trigger — a crate becomes
 * overdue purely by sitting at WITH_CUSTOMER too long, not because of any
 * single action. The schema has no dedicated "assigned since" field on
 * Crate, so `updatedAt` is used as a pragmatic proxy for "since it last
 * changed status" (it's set whenever `status` — or anything else on the row —
 * changes, which in practice is when the crate was last moved to
 * WITH_CUSTOMER). This is a documented, deliberate approximation, not a
 * precise "days with customer" count.
 *
 * Threshold is configurable via Settings > Crate Overdue Threshold (days);
 * falls back to 14 days if unset.
 */
export async function getOverdueDays(): Promise<number> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: "CRATE_OVERDUE_THRESHOLD_DAYS" },
  });
  return typeof setting?.value === "number" ? setting.value : 14;
}

/**
 * Query-driven check, meant to be called opportunistically (e.g. whenever the
 * crates list page is viewed) rather than on a schedule. Finds every Crate
 * stuck at WITH_CUSTOMER for longer than OVERDUE_DAYS and creates a
 * CRATE_OVERDUE notification to Store Manager — but skips any crate that
 * already has an unread CRATE_OVERDUE notification, so repeated calls don't
 * spam the notification list.
 */
export async function checkOverdueCratesAndNotify(): Promise<void> {
  const overdueDays = await getOverdueDays();
  const threshold = new Date(Date.now() - overdueDays * 24 * 60 * 60 * 1000);

  const overdueCrates = await prisma.crate.findMany({
    where: { status: "WITH_CUSTOMER", updatedAt: { lte: threshold } },
    select: { id: true, crateCode: true, updatedAt: true, customer: { select: { name: true } } },
  });

  for (const crate of overdueCrates) {
    const existing = await prisma.notification.findFirst({
      // One alert per stay with the customer (read state is per user now, so it can't be the dedupe key).
      where: { type: "CRATE_OVERDUE", entityType: "Crate", entityId: crate.id, createdAt: { gte: crate.updatedAt } },
      select: { id: true },
    });
    if (existing) continue;

    const daysSince = Math.floor((Date.now() - crate.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
    await notifyRoleByName("Store Manager", {
      type: "CRATE_OVERDUE",
      title: "Crate overdue with customer",
      message: `Crate ${crate.crateCode}${crate.customer ? ` (with ${crate.customer.name})` : ""} has been with the customer for ${daysSince} days.`,
      entityType: "Crate",
      entityId: crate.id,
    });
  }
}
