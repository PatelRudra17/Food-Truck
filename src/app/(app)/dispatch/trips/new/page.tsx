import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { TripForm } from "@/components/trips/trip-form";

export const metadata = { title: "New Trip" };

export default async function NewTripPage() {
  await requirePermission("TRIP_CREATE");
  const user = await getSessionUser();

  const [customers, routes, vehicles, drivers, staff, items, salesOrders] = await Promise.all([
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerCode: true },
    }),
    prisma.route.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, routeNumber: true },
    }),
    prisma.vehicle.findMany({
      orderBy: { vehicleNumber: "asc" },
      select: { id: true, vehicleNumber: true },
    }),
    prisma.driver.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, sku: true, unit: true, warehouseId: true },
    }),
    // Sales Order module may not be populated yet (built in parallel) — an empty
    // list here just means every trip is created as a standalone ad-hoc dispatch.
    prisma.salesOrder.findMany({
      where: { status: { in: ["APPROVED", "READY_FOR_DISPATCH", "PARTIALLY_FULFILLED"] } },
      orderBy: { orderDate: "desc" },
      select: {
        id: true,
        soNumber: true,
        customerId: true,
        items: {
          select: { id: true, itemId: true, grade: true, quantity: true, fulfilledQty: true, item: { select: { name: true } } },
        },
      },
    }),
  ]);

  const canOverride =
    hasPermission(user, "OVERRIDE_MAINTENANCE_BLOCK") || hasPermission(user, "OVERRIDE_NEGATIVE_STOCK");

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Trip"
        description="Dispatch a vehicle to a customer, standalone or linked to a sales order, with grade-wise line items."
      />
      <TripForm
        customers={customers}
        routes={routes}
        vehicles={vehicles}
        drivers={drivers}
        staff={staff}
        items={items.map((i) => ({ id: i.id, name: i.name, sku: i.sku, unit: i.unit, hasWarehouse: !!i.warehouseId }))}
        salesOrders={salesOrders.map((so) => ({
          id: so.id,
          soNumber: so.soNumber,
          customerId: so.customerId,
          items: so.items
            .map((line) => ({
              salesOrderItemId: line.id,
              itemId: line.itemId,
              itemName: line.item.name,
              grade: line.grade,
              remainingQty: Math.max(0, Number(line.quantity) - Number(line.fulfilledQty)),
            }))
            .filter((line) => line.remainingQty > 0),
        }))}
        canOverride={canOverride}
      />
    </div>
  );
}
