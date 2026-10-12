import { requireAnyPermission } from "@/lib/auth/guard";
import { APPROVAL_CENTER_PERMISSIONS, approvableEntityTypes } from "@/lib/approval-permissions";
import { PageHeader } from "@/components/shared/page-header";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { paginationSchema, dateParam } from "@/lib/validators/common";
import { getApprovalEntityTypes, getApprovalHistory, getPendingApprovals } from "@/lib/services/approvals";
import { PendingApprovalsTable } from "@/components/approvals/pending-approvals-table";
import { ApprovalHistoryTable } from "@/components/approvals/approval-history-table";

export const metadata = { title: "Approval Center" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Settings admins and anyone holding a module's *_APPROVE permission may open the center;
  // each viewer only lists and decides the workflows they can approve.
  const user = await requireAnyPermission(...APPROVAL_CENTER_PERMISSIONS);
  const allowedEntityTypes = approvableEntityTypes(user.permissions);
  // Settings admins keep the full decision history for oversight; others see their own workflows only.
  const historyEntityTypes = user.permissions.includes("MANAGE_SETTINGS") ? undefined : allowedEntityTypes;
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const decision = get("decision") as "PENDING" | "APPROVED" | "REJECTED" | undefined;
  const entityType = get("entityType") || "";
  const dateFrom = dateParam(get("dateFrom"));
  const dateTo = dateParam(get("dateTo"));

  const [pending, history, entityTypes] = await Promise.all([
    getPendingApprovals(allowedEntityTypes),
    getApprovalHistory({
      allowedEntityTypes: historyEntityTypes,
      ...pagination,
      decision: decision || undefined,
      entityType: entityType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    getApprovalEntityTypes(historyEntityTypes),
  ]);

  const hiddenParams: Record<string, string> = {};
  if (decision) hiddenParams.decision = decision;
  if (entityType) hiddenParams.entityType = entityType;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Approval Center"
        description="A single place to review and act on every pending approval — Stock Outward, Stock Adjustment, Purchase Order, Stock Transfer, Stock Inward, Sales Order, and Wastage — plus the full decision history."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Approvals</CardTitle>
          <CardDescription>
            {pending.length} request{pending.length === 1 ? "" : "s"} awaiting your decision, oldest first. Only
            workflows you can approve are listed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PendingApprovalsTable rows={pending} />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Approval History</h2>
          <p className="text-sm text-muted-foreground">
            Every approval decision ever recorded, across all workflows.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <TableFilterSelect
              paramKey="decision"
              placeholder="All decisions"
              options={[
                { value: "PENDING", label: "Pending" },
                { value: "APPROVED", label: "Approved" },
                { value: "REJECTED", label: "Rejected" },
              ]}
            />
            <TableFilterSelect
              paramKey="entityType"
              placeholder="All entity types"
              options={entityTypes.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <form className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label htmlFor="dateFrom" className="text-xs text-muted-foreground">
                From
              </label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>
            <div className="space-y-1">
              <label htmlFor="dateTo" className="text-xs text-muted-foreground">
                To
              </label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>
            {decision && <input type="hidden" name="decision" value={decision} />}
            {entityType && <input type="hidden" name="entityType" value={entityType} />}
            <Button type="submit" variant="outline">
              Apply Dates
            </Button>
          </form>
        </div>

        <ApprovalHistoryTable rows={history.rows} pagination={history.meta} />
      </div>
    </div>
  );
}
