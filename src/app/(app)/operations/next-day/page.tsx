import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PrepFormDialog } from "@/components/next-day-prep/prep-form-dialog";
import { PrepListTable, type PrepListRow } from "@/components/next-day-prep/prep-list-table";
import { ClipboardList, CalendarPlus, CircleCheck } from "lucide-react";

export const metadata = { title: "Next-Day Preparation" };

export default async function NextDayPreparationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("OPERATIONS_VIEW");
  const canCreate = hasPermission(user, "OPERATIONS_CREATE");

  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });

  const [total, preps, todayPrep] = await Promise.all([
    prisma.nextDayPreparation.count(),
    prisma.nextDayPreparation.findMany({
      include: {
        createdBy: { select: { name: true } },
        checklistItems: { select: { status: true } },
      },
      orderBy: { date: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.nextDayPreparation.findFirst({
      where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      orderBy: { date: "asc" },
      include: { checklistItems: { select: { status: true } } },
    }),
  ]);

  const rows: PrepListRow[] = preps.map((p) => ({
    id: p.id,
    date: p.date.toISOString(),
    createdByName: p.createdBy.name,
    totalItems: p.checklistItems.length,
    completeItems: p.checklistItems.filter((i) => i.status === "COMPLETE").length,
    remarks: p.remarks,
  }));

  const upcomingComplete = todayPrep?.checklistItems.filter((i) => i.status === "COMPLETE").length ?? 0;
  const upcomingTotal = todayPrep?.checklistItems.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Next-Day Preparation"
        description="Prepare and track tomorrow's readiness checklist across vehicles, drivers, crates, and inventory."
        actions={canCreate ? <PrepFormDialog trigger={<Button>New Preparation</Button>} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Checklists" value={total} icon={ClipboardList} />
        <KpiCard
          label="Next Upcoming"
          value={todayPrep ? todayPrep.date.toLocaleDateString("en-IN") : "None"}
          icon={CalendarPlus}
        />
        <KpiCard
          label="Upcoming Progress"
          value={upcomingTotal > 0 ? `${upcomingComplete}/${upcomingTotal}` : "—"}
          icon={CircleCheck}
        />
      </div>

      <PrepListTable rows={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
