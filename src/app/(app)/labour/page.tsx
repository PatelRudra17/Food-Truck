import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { paginationSchema } from "@/lib/validators/common";
import { listLabour, listLabourWorkTypes } from "@/lib/services/labour";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { Button } from "@/components/ui/button";
import { LabourTable } from "@/components/labour/labour-table";
import { LabourFormDialog } from "@/components/labour/labour-form-dialog";
import { format } from "date-fns";

export const metadata = { title: "Labour" };

export default async function LabourPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("LABOUR_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim();
  const status = get("status")?.trim();
  const workType = get("workType")?.trim();

  const [{ rows, pagination: paginationMeta }, workTypes, shifts] = await Promise.all([
    listLabour(pagination, { q: q || undefined, status: status || undefined, workType: workType || undefined }),
    listLabourWorkTypes(),
    prisma.shift.findMany({ orderBy: { date: "desc" }, select: { id: true, shiftName: true, date: true } }),
  ]);

  const shiftOptions = shifts.map((s) => ({ id: s.id, shiftName: s.shiftName, date: format(s.date, "dd MMM yyyy") }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labour"
        description="Manage daily-wage labour records, their shift assignment, and employment status."
        actions={
          hasPermission(user, "LABOUR_CREATE") ? (
            <LabourFormDialog mode="create" shiftOptions={shiftOptions} trigger={<Button size="sm">New Labour</Button>} />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by name, code or mobile..." />
          <TableFilterSelect
            paramKey="status"
            placeholder="All statuses"
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "ON_LEAVE", label: "On Leave" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
          {workTypes.length > 0 && (
            <TableFilterSelect
              paramKey="workType"
              placeholder="All work types"
              options={workTypes.map((w) => ({ value: w, label: w }))}
            />
          )}
        </div>
      </div>

      <LabourTable
        data={rows.map((labour) => ({
          id: labour.id,
          labourCode: labour.labourCode,
          name: labour.name,
          mobile: labour.mobile,
          workType: labour.workType,
          dailyWage: Number(labour.dailyWage),
          status: labour.status,
          shiftName: labour.shift?.shiftName ?? null,
        }))}
        pagination={paginationMeta}
        canArchive={hasPermission(user, "LABOUR_ARCHIVE")}
      />
    </div>
  );
}
