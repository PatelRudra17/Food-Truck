import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getOperationsSnapshot } from "@/lib/actions/shift-handover-actions";
import { HandoverSummary } from "@/components/shift-handover/handover-summary";
import { HandoverForm } from "@/components/shift-handover/handover-form";
import { HandoverHistory, type HandoverHistoryRow } from "@/components/shift-handover/handover-history";
import { CalendarClock } from "lucide-react";

export const metadata = { title: "Shift Handover" };

export default async function ShiftHandoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("OPERATIONS_VIEW");
  const canCreate = hasPermission(user, "OPERATIONS_CREATE");

  const sp = await searchParams;
  const single = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const requestedShiftId = single(sp.shiftId) || "";

  const [shifts, users, snapshot] = await Promise.all([
    prisma.shift.findMany({
      select: { id: true, shiftName: true, date: true, status: true },
      orderBy: [{ status: "asc" }, { date: "desc" }],
      take: 50,
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getOperationsSnapshot(),
  ]);

  const defaultShiftId =
    (requestedShiftId && shifts.some((s) => s.id === requestedShiftId) ? requestedShiftId : "") ||
    shifts.find((s) => s.status === "ACTIVE")?.id ||
    shifts[0]?.id ||
    "";

  const shiftOptions = shifts.map((s) => ({
    id: s.id,
    label: `${s.shiftName} — ${s.date.toLocaleDateString("en-IN")}${s.status === "CLOSED" ? " (Closed)" : ""}`,
  }));
  const userOptions = users.map((u) => ({ id: u.id, label: u.name }));

  const handovers = defaultShiftId
    ? await prisma.shiftHandover.findMany({
        where: { shiftId: defaultShiftId },
        include: {
          shift: { select: { shiftName: true } },
          previousSupervisor: { select: { name: true } },
          newSupervisor: { select: { name: true } },
        },
        orderBy: { handoverAt: "desc" },
        take: 20,
      })
    : [];

  const historyRows: HandoverHistoryRow[] = handovers.map((h) => ({
    id: h.id,
    handoverAt: h.handoverAt.toISOString(),
    shiftName: h.shift.shiftName,
    previousSupervisorName: h.previousSupervisor?.name ?? null,
    newSupervisorName: h.newSupervisor?.name ?? null,
    stockIssuesNote: h.stockIssuesNote,
    cleaningStatusNote: h.cleaningStatusNote,
    crateStatusNote: h.crateStatusNote,
    remarks: h.remarks,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Shift Handover" description="Hand over a shift with a live snapshot of operations plus manual notes." />

      <HandoverSummary snapshot={snapshot} />

      {shifts.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No shifts to hand over yet." description="Create a shift first from the Shifts page." actionLabel="Go to Shifts" actionHref="/operations/shifts" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {canCreate ? (
            <HandoverForm shiftOptions={shiftOptions} userOptions={userOptions} defaultShiftId={defaultShiftId} />
          ) : (
            <EmptyState icon={CalendarClock} title="You don't have permission to record a handover." />
          )}
          <HandoverHistory rows={historyRows} />
        </div>
      )}
    </div>
  );
}
