import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { listAttendanceForDate, listAttendanceGroups } from "@/lib/services/attendance";
import { PageHeader } from "@/components/shared/page-header";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceGrid } from "@/components/attendance/attendance-grid";
import { AttendanceDatePicker } from "@/components/attendance/attendance-date-picker";

export const metadata = { title: "Attendance" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("ATTENDANCE_VIEW");
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const dateParam = get("date")?.trim();
  const date = dateParam ? new Date(dateParam) : new Date(new Date().toISOString().slice(0, 10));
  const dateStr = format(date, "yyyy-MM-dd");

  const q = get("q")?.trim();
  const personType = get("personType")?.trim();
  const shiftId = get("shiftId")?.trim();
  const group = get("group")?.trim();
  const status = get("status")?.trim();

  const [rows, groups, shifts] = await Promise.all([
    listAttendanceForDate(date, {
      q: q || undefined,
      personType: personType || undefined,
      shiftId: shiftId || undefined,
      group: group || undefined,
      status: status || undefined,
    }),
    listAttendanceGroups(),
    prisma.shift.findMany({ orderBy: { date: "desc" }, select: { id: true, shiftName: true } }),
  ]);

  const presentCount = rows.filter((r) => r.status === "PRESENT").length;
  const absentCount = rows.filter((r) => r.status === "ABSENT").length;
  const halfDayCount = rows.filter((r) => r.status === "HALF_DAY").length;
  const notMarkedCount = rows.filter((r) => r.status === null).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Mark daily attendance for employees and labour. One row per person per date."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-4">
          <AttendanceDatePicker defaultValue={dateStr} />

          <TableSearchInput placeholder="Search by name or code..." />

          <TableFilterSelect
            paramKey="personType"
            placeholder="All types"
            options={[
              { value: "EMPLOYEE", label: "Employee" },
              { value: "LABOUR", label: "Labour" },
            ]}
          />

          {shifts.length > 0 && (
            <TableFilterSelect
              paramKey="shiftId"
              placeholder="All shifts"
              options={shifts.map((s) => ({ value: s.id, label: s.shiftName }))}
            />
          )}

          {groups.length > 0 && (
            <TableFilterSelect
              paramKey="group"
              placeholder="All departments"
              options={groups.map((g) => ({ value: g, label: g }))}
            />
          )}

          <TableFilterSelect
            paramKey="status"
            placeholder="All statuses"
            options={[
              { value: "PRESENT", label: "Present" },
              { value: "ABSENT", label: "Absent" },
              { value: "HALF_DAY", label: "Half Day" },
              { value: "NOT_MARKED", label: "Not Marked" },
            ]}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="text-2xl font-semibold">{presentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="text-2xl font-semibold">{absentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Half Day</p>
            <p className="text-2xl font-semibold">{halfDayCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Not Marked</p>
            <p className="text-2xl font-semibold">{notMarkedCount}</p>
          </CardContent>
        </Card>
      </div>

      <AttendanceGrid date={dateStr} rows={rows} />
    </div>
  );
}
