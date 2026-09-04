import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdjustmentActions } from "@/components/stock-adjustment/adjustment-actions";
import { AdjustmentAttachment } from "@/components/stock-adjustment/adjustment-attachment";
import { cn } from "@/lib/utils";

export const metadata = { title: "Stock Adjustment Detail" };

export default async function StockAdjustmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("STOCK_ADJUSTMENT_VIEW");
  const { id } = await params;

  const adjustment = await prisma.stockAdjustment.findUnique({
    where: { id },
    include: {
      item: true,
      warehouse: true,
      createdBy: true,
      approvedBy: true,
      attachments: true,
      approvals: { orderBy: { requestedAt: "desc" }, include: { requestedBy: true, decidedBy: true } },
    },
  });

  if (!adjustment) notFound();

  const difference = Number(adjustment.difference);
  const differenceLabel = `${difference > 0 ? "+" : ""}${difference.toLocaleString()} ${adjustment.item.unit}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={adjustment.adjustmentNumber}
        description={`${adjustment.item.name} at ${adjustment.warehouse.name}`}
        actions={
          <AdjustmentActions
            id={adjustment.id}
            status={adjustment.status}
            canApprove={hasPermission(user, "STOCK_ADJUSTMENT_APPROVE")}
            differenceLabel={differenceLabel}
          />
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={adjustment.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requested By</p>
              <p className="text-sm font-medium">{adjustment.createdBy.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Item</p>
              <p className="text-sm font-medium">
                {adjustment.item.name} ({adjustment.item.sku})
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Warehouse</p>
              <p className="text-sm font-medium">{adjustment.warehouse.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Qty (at request)</p>
              <p className="text-sm font-medium tabular-nums">
                {Number(adjustment.currentQty).toLocaleString()} {adjustment.item.unit}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Physical Qty (counted)</p>
              <p className="text-sm font-medium tabular-nums">
                {Number(adjustment.physicalQty).toLocaleString()} {adjustment.item.unit}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Difference</p>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  difference > 0 && "text-emerald-600 dark:text-emerald-400",
                  difference < 0 && "text-red-600 dark:text-red-400",
                )}
              >
                {differenceLabel}
              </p>
            </div>
            {adjustment.approvedBy && (
              <div>
                <p className="text-xs text-muted-foreground">Approved By</p>
                <p className="text-sm font-medium">{adjustment.approvedBy.name}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Reason</p>
              <p className="text-sm">{adjustment.reason}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {adjustment.approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approval record yet.</p>
            ) : (
              adjustment.approvals.map((approval) => (
                <div key={approval.id} className="space-y-1 border-b pb-2 text-sm last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{approval.requestedBy.name}</span>
                    <StatusBadge status={approval.decision} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Requested {format(approval.requestedAt, "dd MMM yyyy HH:mm")}
                  </p>
                  {approval.decidedBy && approval.decidedAt && (
                    <p className="text-xs text-muted-foreground">
                      Decided by {approval.decidedBy.name} on {format(approval.decidedAt, "dd MMM yyyy HH:mm")}
                    </p>
                  )}
                  {approval.comment && <p className="text-xs italic">"{approval.comment}"</p>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {adjustment.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {adjustment.attachments.map((att) => (
                <AdjustmentAttachment key={att.id} id={att.id} fileName={att.fileName} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
