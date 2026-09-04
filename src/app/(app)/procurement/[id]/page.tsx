import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Boxes } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProcurementWorkflowActions } from "@/components/procurement/procurement-workflow-actions";

export const metadata = { title: "Procurement Details" };

export default async function ProcurementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("PROCUREMENT_VIEW");
  const user = await getSessionUser();
  const { id } = await params;

  const procurement = await prisma.procurement.findUnique({
    where: { id },
    include: {
      supplier: true,
      warehouse: { select: { name: true, code: true } },
      vehicle: { select: { id: true, vehicleNumber: true } },
      driver: { select: { id: true, fullName: true } },
      gateEntry: { select: { id: true, gateEntryNumber: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
      createdBy: { select: { name: true } },
      items: {
        include: {
          item: { select: { name: true, sku: true } },
          batch: { select: { id: true, batchNumber: true, status: true } },
        },
      },
    },
  });
  if (!procurement) notFound();

  const canEdit = hasPermission(user, "PROCUREMENT_EDIT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={procurement.procurementNumber}
        description={`Procurement from ${procurement.supplier.companyName}`}
        actions={
          <ProcurementWorkflowActions
            procurementId={procurement.id}
            procurementNumber={procurement.procurementNumber}
            status={procurement.status}
            canEdit={canEdit}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Procurement Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={procurement.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="mt-0.5">
                <Link href={`/suppliers/${procurement.supplier.id}`} className="font-medium hover:underline">
                  {procurement.supplier.companyName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="mt-0.5">{format(procurement.date, "dd MMM yyyy")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Warehouse</dt>
              <dd className="mt-0.5">
                {procurement.warehouse.name} ({procurement.warehouse.code})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd className="mt-0.5">
                {procurement.vehicle ? (
                  <Link href={`/vehicles/${procurement.vehicle.id}`} className="hover:underline">
                    {procurement.vehicle.vehicleNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Driver</dt>
              <dd className="mt-0.5">
                {procurement.driver ? (
                  <Link href={`/drivers/${procurement.driver.id}`} className="hover:underline">
                    {procurement.driver.fullName}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gate Entry</dt>
              <dd className="mt-0.5">{procurement.gateEntry?.gateEntryNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Purchase Order</dt>
              <dd className="mt-0.5">
                {procurement.purchaseOrder ? (
                  <Link href={`/purchase-orders/${procurement.purchaseOrder.id}`} className="hover:underline">
                    {procurement.purchaseOrder.poNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Invoice Number</dt>
              <dd className="mt-0.5">{procurement.invoiceNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created By</dt>
              <dd className="mt-0.5">{procurement.createdBy.name}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">Remarks</dt>
              <dd className="mt-0.5">{procurement.remarks ?? "—"}</dd>
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
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procurement.items.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">{line.item.sku}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.quantity).toLocaleString()} {line.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.weight).toLocaleString()} kg
                    </TableCell>
                    <TableCell>{line.quality ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.purchasePrice ? Number(line.purchasePrice).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {line.total ? Number(line.total).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      {line.batch ? (
                        <Link href={`/procurement/batches/${line.batch.id}`} className="hover:underline">
                          {line.batch.batchNumber}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not yet created</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {procurement.items.every((line) => !line.batch) ? (
            <EmptyState
              icon={Boxes}
              title="No batches yet"
              description="Submitting this procurement will create a traceable batch for every line item."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procurement.items
                  .filter((line) => line.batch)
                  .map((line) => (
                    <TableRow key={line.batch!.id}>
                      <TableCell>
                        <Link href={`/procurement/batches/${line.batch!.id}`} className="font-medium hover:underline">
                          {line.batch!.batchNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{line.item.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={line.batch!.status} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
