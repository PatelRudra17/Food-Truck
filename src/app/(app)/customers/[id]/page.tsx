import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Pencil, User, ClipboardList, Truck, PackageOpen } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata = { title: "Customer Details" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("CUSTOMER_VIEW");
  const user = await getSessionUser();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const [salesOrders, trips, crates] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { customerId: id },
      orderBy: { orderDate: "desc" },
      take: 50,
      select: { id: true, soNumber: true, orderDate: true, status: true, totalAmount: true },
    }),
    prisma.trip.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        tripNumber: true,
        status: true,
        departureAt: true,
        deliveredAt: true,
        vehicle: { select: { vehicleNumber: true } },
      },
    }),
    prisma.crate.findMany({
      where: { customerId: id },
      orderBy: { crateCode: "asc" },
      take: 50,
      select: { id: true, crateCode: true, crateType: true, status: true, currentLocation: true },
    }),
  ]);

  const canEdit = hasPermission(user, "CUSTOMER_EDIT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={`Customer code: ${customer.customerCode}`}
        actions={
          canEdit ? (
            <CustomerFormDialog
              customer={{
                id: customer.id,
                customerCode: customer.customerCode,
                name: customer.name,
                contactPerson: customer.contactPerson ?? "",
                phone: customer.phone ?? "",
                email: customer.email ?? "",
                address: customer.address ?? "",
                location: customer.location ?? "",
                gstNumber: customer.gstNumber ?? "",
                status: customer.status,
              }}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              }
            />
          ) : undefined
        }
      />

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <User className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Customer Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={customer.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact Person</dt>
              <dd className="mt-0.5">{customer.contactPerson ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-0.5">{customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5">{customer.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Location</dt>
              <dd className="mt-0.5">{customer.location ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">GST Number</dt>
              <dd className="mt-0.5">{customer.gstNumber ?? "—"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="mt-0.5">{customer.address ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Sales Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {salesOrders.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No records yet" description="No sales orders have been raised for this customer." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SO Number</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesOrders.map((so) => (
                  <TableRow key={so.id}>
                    <TableCell className="font-medium">{so.soNumber}</TableCell>
                    <TableCell>{format(so.orderDate, "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={so.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(so.totalAmount).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Trips</CardTitle>
        </CardHeader>
        <CardContent>
          {trips.length === 0 ? (
            <EmptyState icon={Truck} title="No records yet" description="No trips have been made for this customer." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip Number</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Departure</TableHead>
                  <TableHead>Delivered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trips.map((trip) => (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.tripNumber}</TableCell>
                    <TableCell>{trip.vehicle.vehicleNumber}</TableCell>
                    <TableCell>
                      <StatusBadge status={trip.status} />
                    </TableCell>
                    <TableCell>{trip.departureAt ? format(trip.departureAt, "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell>{trip.deliveredAt ? format(trip.deliveredAt, "dd MMM yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <PackageOpen className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Crates</CardTitle>
        </CardHeader>
        <CardContent>
          {crates.length === 0 ? (
            <EmptyState icon={PackageOpen} title="No records yet" description="No crates are currently associated with this customer." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Crate Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crates.map((crate) => (
                  <TableRow key={crate.id}>
                    <TableCell className="font-medium">{crate.crateCode}</TableCell>
                    <TableCell>{crate.crateType}</TableCell>
                    <TableCell>
                      <StatusBadge status={crate.status} />
                    </TableCell>
                    <TableCell>{crate.currentLocation ?? "—"}</TableCell>
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
