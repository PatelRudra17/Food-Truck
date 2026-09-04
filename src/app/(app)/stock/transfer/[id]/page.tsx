import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TransferActions } from "@/components/stock-transfer/transfer-actions";

export const metadata = { title: "Stock Transfer Detail" };

export default async function StockTransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("STOCK_TRANSFER_VIEW");
  const { id } = await params;

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      sourceWarehouse: true,
      destWarehouse: true,
      requestedBy: true,
      approvedBy: true,
      items: { include: { item: true } },
      approvals: {
        orderBy: { requestedAt: "desc" },
        include: { requestedBy: true, decidedBy: true },
      },
    },
  });

  if (!transfer) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={transfer.transferNumber}
        description={`${transfer.sourceWarehouse.name} -> ${transfer.destWarehouse.name}`}
        actions={
          <TransferActions
            id={transfer.id}
            status={transfer.status}
            canCreate={hasPermission(user, "STOCK_TRANSFER_CREATE")}
            canEdit={hasPermission(user, "STOCK_TRANSFER_EDIT")}
            canApprove={hasPermission(user, "STOCK_TRANSFER_APPROVE")}
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
              <StatusBadge status={transfer.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Requested By</p>
              <p className="text-sm font-medium">{transfer.requestedBy.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Source Warehouse</p>
              <p className="text-sm font-medium">{transfer.sourceWarehouse.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Destination Warehouse</p>
              <p className="text-sm font-medium">{transfer.destWarehouse.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dispatch Date</p>
              <p className="text-sm font-medium">
                {transfer.dispatchDate ? format(transfer.dispatchDate, "dd MMM yyyy HH:mm") : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Received Date</p>
              <p className="text-sm font-medium">
                {transfer.receivedDate ? format(transfer.receivedDate, "dd MMM yyyy HH:mm") : "—"}
              </p>
            </div>
            {transfer.remarks && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Remarks</p>
                <p className="text-sm">{transfer.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transfer.approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not yet submitted for approval.</p>
            ) : (
              transfer.approvals.map((approval) => (
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Batch #</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.items.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">{line.item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{line.item.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(line.quantity).toLocaleString()}</TableCell>
                  <TableCell>{line.unit}</TableCell>
                  <TableCell>{line.batchNumber ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
