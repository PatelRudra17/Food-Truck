import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Printer, ArrowDownToLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseOrderWorkflowActions } from "@/components/purchase-orders/po-workflow-actions";

export const metadata = { title: "Purchase Order Details" };

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("PURCHASE_ORDER_VIEW");
  const user = await getSessionUser();
  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      items: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      approvals: { orderBy: { requestedAt: "desc" }, include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } } },
    },
  });
  if (!po) notFound();

  const inwards = await prisma.stockInward.findMany({
    where: { purchaseOrderId: id },
    orderBy: { date: "desc" },
    select: { id: true, inwardNumber: true, date: true, status: true },
  });

  const canEdit = hasPermission(user, "PURCHASE_ORDER_EDIT");
  const canApprove = hasPermission(user, "PURCHASE_ORDER_APPROVE");
  const canPrint = hasPermission(user, "PURCHASE_ORDER_PRINT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={po.poNumber}
        description={`Purchase order to ${po.supplier.companyName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canPrint && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/purchase-orders/${po.id}/print`} target="_blank">
                  <Printer className="h-4 w-4" /> Print
                </Link>
              </Button>
            )}
            <PurchaseOrderWorkflowActions
              poId={po.id}
              poNumber={po.poNumber}
              status={po.status}
              canEdit={canEdit}
              canApprove={canApprove}
            />
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={po.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="mt-0.5">
                <Link href={`/suppliers/${po.supplier.id}`} className="font-medium hover:underline">
                  {po.supplier.companyName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="mt-0.5">{format(po.date, "dd MMM yyyy")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected Delivery</dt>
              <dd className="mt-0.5">
                {po.expectedDelivery ? format(po.expectedDelivery, "dd MMM yyyy") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created By</dt>
              <dd className="mt-0.5">{po.createdBy.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Approved By</dt>
              <dd className="mt-0.5">{po.approvedBy?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Amount</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{Number(po.totalAmount).toLocaleString()}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">Remarks</dt>
              <dd className="mt-0.5">{po.remarks ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Ordered Qty</TableHead>
                  <TableHead className="text-right">Received Qty</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.items.map((line) => {
                  const ordered = Number(line.quantity);
                  const received = Number(line.receivedQuantity);
                  const pct = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0;
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <p className="font-medium">{line.item.name}</p>
                        <p className="text-xs text-muted-foreground">{line.item.sku}</p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ordered.toLocaleString()} {line.item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {received.toLocaleString()} {line.item.unit}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5" />
                          <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(line.rate).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.taxPercent ? Number(line.taxPercent) : 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(line.total).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Stock Inward Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {inwards.length === 0 ? (
            <EmptyState
              icon={ArrowDownToLine}
              title="No inward receipts yet"
              description="Stock Inward entries referencing this PO will appear here once goods are received."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inward Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inwards.map((inward) => (
                  <TableRow key={inward.id}>
                    <TableCell>
                      <Link href={`/stock/inward/${inward.id}`} className="font-medium hover:underline">
                        {inward.inwardNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{format(inward.date, "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={inward.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {po.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Decided By</TableHead>
                  <TableHead>Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.approvals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell>{approval.requestedBy.name}</TableCell>
                    <TableCell>{format(approval.requestedAt, "dd MMM yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <StatusBadge status={approval.decision} />
                    </TableCell>
                    <TableCell>{approval.decidedBy?.name ?? "—"}</TableCell>
                    <TableCell>{approval.comment ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
