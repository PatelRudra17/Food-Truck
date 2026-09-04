import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesOrderWorkflowActions } from "@/components/sales-orders/so-workflow-actions";

export const metadata = { title: "Sales Order Details" };

const GRADE_LABELS: Record<string, string> = {
  RAW: "Raw",
  GRADE_A: "Grade A",
  GRADE_B: "Grade B",
  GRADE_C: "Grade C",
  OTHER: "Other",
};

export default async function SalesOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("SALES_ORDER_VIEW");
  const user = await getSessionUser();
  const { id } = await params;

  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      items: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      approvals: {
        orderBy: { requestedAt: "desc" },
        include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
      },
    },
  });
  if (!so) notFound();

  const trips = await prisma.trip.findMany({
    where: { salesOrderId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      tripNumber: true,
      status: true,
      departureAt: true,
      vehicle: { select: { vehicleNumber: true } },
      driver: { select: { fullName: true } },
    },
  });

  const canEdit = hasPermission(user, "SALES_ORDER_EDIT");
  const canApprove = hasPermission(user, "SALES_ORDER_APPROVE");

  return (
    <div className="space-y-6">
      <PageHeader
        title={so.soNumber}
        description={`Sales order for ${so.customer.name}`}
        actions={
          <SalesOrderWorkflowActions
            soId={so.id}
            soNumber={so.soNumber}
            status={so.status}
            canEdit={canEdit}
            canApprove={canApprove}
          />
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
                <StatusBadge status={so.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="mt-0.5">
                <Link href={`/customers/${so.customer.id}`} className="font-medium hover:underline">
                  {so.customer.name}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Customer Location</dt>
              <dd className="mt-0.5">{so.customer.location ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Priority</dt>
              <dd className="mt-0.5">{so.priority ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Order Date</dt>
              <dd className="mt-0.5">{format(so.orderDate, "dd MMM yyyy")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Delivery Date</dt>
              <dd className="mt-0.5">{so.deliveryDate ? format(so.deliveryDate, "dd MMM yyyy") : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created By</dt>
              <dd className="mt-0.5">{so.createdBy.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Approved By</dt>
              <dd className="mt-0.5">{so.approvedBy?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Amount</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{Number(so.totalAmount).toLocaleString()}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">Remarks</dt>
              <dd className="mt-0.5">{so.remarks ?? "—"}</dd>
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
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-right">Ordered Qty</TableHead>
                  <TableHead className="text-right">Fulfilled Qty</TableHead>
                  <TableHead className="text-right">Pending Qty</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Dispatch Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {so.items.map((line) => {
                  const ordered = Number(line.quantity);
                  const fulfilled = Number(line.fulfilledQty);
                  const pending = Math.max(0, ordered - fulfilled);
                  const pct = ordered > 0 ? Math.min(100, Math.round((fulfilled / ordered) * 100)) : 0;
                  const dispatchStatus =
                    fulfilled <= 0 ? "PENDING" : fulfilled >= ordered ? "FULFILLED" : "PARTIALLY_FULFILLED";
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <p className="font-medium">{line.item.name}</p>
                        <p className="text-xs text-muted-foreground">{line.item.sku}</p>
                      </TableCell>
                      <TableCell>{GRADE_LABELS[line.grade] ?? line.grade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {ordered.toLocaleString()} {line.item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fulfilled.toLocaleString()} {line.item.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {pending.toLocaleString()} {line.item.unit}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5" />
                          <span className="w-9 text-right text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(line.rate).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(line.total).toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge status={dispatchStatus} />
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
          <Truck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Dispatch Trips</CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No dispatch trips yet"
              description="Trips created against this sales order will appear here once dispatch planning begins."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip Number</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.tripNumber}</TableCell>
                    <TableCell>{trip.vehicle.vehicleNumber}</TableCell>
                    <TableCell>{trip.driver.fullName}</TableCell>
                    <TableCell>{trip.departureAt ? format(trip.departureAt, "dd MMM yyyy HH:mm") : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={trip.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {so.approvals.length > 0 && (
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
                {so.approvals.map((approval) => (
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
