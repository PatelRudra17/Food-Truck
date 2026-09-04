import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InwardStatusActions } from "@/components/stock-inward/inward-status-actions";
import { InwardAttachments } from "@/components/stock-inward/inward-attachments";

export const metadata = { title: "Stock Inward Detail" };

export default async function StockInwardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("STOCK_INWARD_VIEW");
  const { id } = await params;

  const inward = await prisma.stockInward.findUnique({
    where: { id },
    include: {
      supplier: true,
      purchaseOrder: true,
      warehouse: true,
      vehicle: true,
      driver: true,
      receivedBy: true,
      items: { include: { item: true }, orderBy: { id: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
      approvals: {
        include: { requestedBy: true, decidedBy: true },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!inward) notFound();

  const canEdit = hasPermission(user, "STOCK_INWARD_EDIT");
  const canApprove = hasPermission(user, "STOCK_INWARD_APPROVE");
  const canPrint = hasPermission(user, "STOCK_INWARD_PRINT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={inward.inwardNumber}
        description={`Stock Inward · Created ${format(inward.createdAt, "dd MMM yyyy HH:mm")}`}
        actions={
          <InwardStatusActions
            inwardId={inward.id}
            status={inward.status}
            canEdit={canEdit}
            canApprove={canApprove}
            canPrint={canPrint}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Status">
            <StatusBadge status={inward.status} />
          </Detail>
          <Detail label="Date">{format(inward.date, "dd MMM yyyy")}</Detail>
          <Detail label="Supplier">{inward.supplier?.companyName ?? "—"}</Detail>
          <Detail label="Purchase Order">{inward.purchaseOrder?.poNumber ?? "—"}</Detail>
          <Detail label="Invoice Number">{inward.invoiceNumber ?? "—"}</Detail>
          <Detail label="Warehouse">{inward.warehouse.name}</Detail>
          <Detail label="Vehicle">{inward.vehicle?.vehicleNumber ?? "—"}</Detail>
          <Detail label="Driver">{inward.driver?.fullName ?? "—"}</Detail>
          <Detail label="Created / Received By">{inward.receivedBy.name}</Detail>
          <Detail label="Remarks" className="sm:col-span-2 lg:col-span-4">
            {inward.remarks ?? "—"}
          </Detail>
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
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Tax %</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inward.items.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">{line.item.sku}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.quantity).toLocaleString()}
                    </TableCell>
                    <TableCell>{line.unit}</TableCell>
                    <TableCell>{line.batchNumber ?? "—"}</TableCell>
                    <TableCell>{line.serialNumber ?? "—"}</TableCell>
                    <TableCell>
                      {line.expiryDate ? format(line.expiryDate, "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.rate != null ? Number(line.rate).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.taxPercent != null ? Number(line.taxPercent).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.total != null ? Number(line.total).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {inward.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {inward.approvals.map((approval) => (
                <li key={approval.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span>
                      Requested by <strong>{approval.requestedBy.name}</strong> on{" "}
                      {format(approval.requestedAt, "dd MMM yyyy HH:mm")}
                    </span>
                    <StatusBadge status={approval.decision} />
                  </div>
                  {approval.decidedBy && approval.decidedAt && (
                    <p className="mt-1 text-muted-foreground">
                      Decided by {approval.decidedBy.name} on{" "}
                      {format(approval.decidedAt, "dd MMM yyyy HH:mm")}
                      {approval.comment ? ` — "${approval.comment}"` : ""}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <InwardAttachments
            inwardId={inward.id}
            canUpload={canEdit}
            attachments={inward.attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              uploadedAt: a.uploadedAt.toISOString(),
              uploadedByName: a.uploadedBy.name,
              sizeBytes: a.sizeBytes,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{children}</div>
    </div>
  );
}
