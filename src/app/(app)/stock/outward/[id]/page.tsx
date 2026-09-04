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
import { OutwardStatusActions } from "@/components/stock-outward/outward-status-actions";
import { OutwardAttachments } from "@/components/stock-outward/outward-attachments";

export const metadata = { title: "Stock Outward Detail" };

export default async function StockOutwardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("STOCK_OUTWARD_VIEW");
  const { id } = await params;

  const outward = await prisma.stockOutward.findUnique({
    where: { id },
    include: {
      warehouse: true,
      vehicle: true,
      driver: true,
      requestedBy: true,
      approvedBy: true,
      items: { include: { item: true }, orderBy: { id: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
      approvals: {
        include: { requestedBy: true, decidedBy: true },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!outward) notFound();

  const canEdit = hasPermission(user, "STOCK_OUTWARD_EDIT");
  const canApprove = hasPermission(user, "STOCK_OUTWARD_APPROVE");
  const canPrint = hasPermission(user, "STOCK_OUTWARD_PRINT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={outward.outwardNumber}
        description={`Stock Outward · Created ${format(outward.createdAt, "dd MMM yyyy HH:mm")}`}
        actions={
          <OutwardStatusActions
            outwardId={outward.id}
            status={outward.status}
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
            <StatusBadge status={outward.status} />
          </Detail>
          <Detail label="Date">{format(outward.date, "dd MMM yyyy")}</Detail>
          <Detail label="Department">{outward.department ?? "—"}</Detail>
          <Detail label="Project">{outward.project ?? "—"}</Detail>
          <Detail label="Warehouse">{outward.warehouse.name}</Detail>
          <Detail label="Destination">{outward.destination ?? "—"}</Detail>
          <Detail label="Receiver">{outward.receiver ?? "—"}</Detail>
          <Detail label="Purpose">{outward.purpose ?? "—"}</Detail>
          <Detail label="Vehicle">{outward.vehicle?.vehicleNumber ?? "—"}</Detail>
          <Detail label="Driver">{outward.driver?.fullName ?? "—"}</Detail>
          <Detail label="Requested By">{outward.requestedBy.name}</Detail>
          <Detail label="Approved By">{outward.approvedBy?.name ?? "—"}</Detail>
          <Detail label="Remarks" className="sm:col-span-2 lg:col-span-4">
            {outward.remarks ?? "—"}
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
                  <TableHead className="text-right">Available (at request)</TableHead>
                  <TableHead className="text-right">Requested Qty</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Serial #</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outward.items.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">{line.item.sku}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.availableQtySnapshot).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.requestedQty).toLocaleString()}
                    </TableCell>
                    <TableCell>{line.unit}</TableCell>
                    <TableCell>{line.batchNumber ?? "—"}</TableCell>
                    <TableCell>{line.serialNumber ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {outward.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval History</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {outward.approvals.map((approval) => (
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
          <OutwardAttachments
            outwardId={outward.id}
            canUpload={canEdit}
            attachments={outward.attachments.map((a) => ({
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
