import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { AlertTriangle, PackageSearch } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GRADE_LABELS } from "@/lib/validators/wastage";
import { TripTimeline } from "@/components/trips/trip-timeline";
import { TripWorkflowActions } from "@/components/trips/trip-workflow-actions";

export const metadata = { title: "Trip Details" };

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("TRIP_VIEW");
  const user = await getSessionUser();
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      customer: true,
      route: true,
      vehicle: true,
      driver: true,
      loadingStaff: { select: { name: true } },
      createdBy: { select: { name: true } },
      salesOrder: { select: { soNumber: true } },
      items: { include: { item: { select: { name: true, sku: true, unit: true } } } },
      crateReturns: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!trip) notFound();

  const canApprove = hasPermission(user, "TRIP_APPROVE");
  const canEdit = hasPermission(user, "TRIP_EDIT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={trip.tripNumber}
        description={`Trip for ${trip.customer.name}${trip.salesOrder ? ` — fulfilling ${trip.salesOrder.soNumber}` : " (standalone dispatch)"}`}
        actions={
          <TripWorkflowActions
            tripId={trip.id}
            tripNumber={trip.tripNumber}
            status={trip.status}
            canApprove={canApprove}
            canEdit={canEdit}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Traceability</CardTitle>
        </CardHeader>
        <CardContent>
          <TripTimeline status={trip.status} />
        </CardContent>
      </Card>

      {trip.eligibilityOverride && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Dispatch eligibility was overridden</p>
            <p>{trip.eligibilityOverrideReason ?? "No reason recorded."}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={trip.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="mt-0.5 font-medium">{trip.customer.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Route</dt>
              <dd className="mt-0.5">{trip.route?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd className="mt-0.5">{trip.vehicle.vehicleNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Driver</dt>
              <dd className="mt-0.5">{trip.driver.fullName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Loading Staff</dt>
              <dd className="mt-0.5">{trip.loadingStaff?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created By</dt>
              <dd className="mt-0.5">{trip.createdBy.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sales Order</dt>
              <dd className="mt-0.5">
                {trip.salesOrder ? trip.salesOrder.soNumber : "Standalone dispatch"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Departure</dt>
              <dd className="mt-0.5">{trip.departureAt ? format(trip.departureAt, "dd MMM yyyy HH:mm") : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Expected Arrival</dt>
              <dd className="mt-0.5">
                {trip.expectedArrivalAt ? format(trip.expectedArrivalAt, "dd MMM yyyy HH:mm") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Delivered At</dt>
              <dd className="mt-0.5">{trip.deliveredAt ? format(trip.deliveredAt, "dd MMM yyyy HH:mm") : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Returned At</dt>
              <dd className="mt-0.5">{trip.returnedAt ? format(trip.returnedAt, "dd MMM yyyy HH:mm") : "—"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-muted-foreground">Remarks</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{trip.remarks ?? "—"}</dd>
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
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Crates</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trip.items.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium">{line.item.name}</p>
                      <p className="text-xs text-muted-foreground">{line.item.sku}</p>
                    </TableCell>
                    <TableCell>{GRADE_LABELS[line.grade] ?? line.grade}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(line.quantity).toLocaleString()} {line.item.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.cratesCount ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Crate Returns</CardTitle>
          {hasPermission(user, "CRATE_CREATE") && (
            <Link href="/crates/returns" className="text-sm font-medium text-primary hover:underline">
              Record a crate return
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {trip.crateReturns.length === 0 ? (
            <EmptyState
              icon={PackageSearch}
              title="No crate returns recorded"
              description="Once this vehicle returns from the customer, record how many crates came back, were damaged, or are missing."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return Number</TableHead>
                  <TableHead className="text-right">Dispatched</TableHead>
                  <TableHead className="text-right">Returned</TableHead>
                  <TableHead className="text-right">Damaged</TableHead>
                  <TableHead className="text-right">Missing</TableHead>
                  <TableHead>Return Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trip.crateReturns.map((cr) => (
                  <TableRow key={cr.id}>
                    <TableCell className="font-medium">{cr.returnNumber}</TableCell>
                    <TableCell className="text-right tabular-nums">{cr.cratesDispatched}</TableCell>
                    <TableCell className="text-right tabular-nums">{cr.cratesReturned}</TableCell>
                    <TableCell className="text-right tabular-nums">{cr.cratesDamaged}</TableCell>
                    <TableCell className="text-right tabular-nums">{cr.cratesMissing}</TableCell>
                    <TableCell>{cr.returnDate ? format(cr.returnDate, "dd MMM yyyy") : "—"}</TableCell>
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
