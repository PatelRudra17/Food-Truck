import Link from "next/link";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TripsTable, type TripRow } from "@/components/trips/trip-table";
import { listTripsAction } from "@/lib/actions/trip-actions";
import { ACTIVE_DISPATCH_STATUSES } from "@/lib/validators/trip";

export const metadata = { title: "Dispatch" };

const TAB_STATUSES: Record<string, readonly string[] | undefined> = {
  active: ACTIVE_DISPATCH_STATUSES,
  pending: ["CREATED", "APPROVED"],
  loading: ["LOADING", "LOADED"],
  dispatched: ["DISPATCHED"],
  delivered: ["DELIVERED"],
  returned: ["RETURNED"],
  cancelled: ["CANCELLED"],
  all: undefined,
};

const TABS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "loading", label: "Loading" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All Trips" },
] as const;

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("TRIP_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const tab = typeof params.tab === "string" && params.tab in TAB_STATUSES ? params.tab : "active";
  const q = typeof params.q === "string" ? params.q : undefined;
  const page = typeof params.page === "string" ? Number(params.page) : undefined;

  const { trips, pagination } = await listTripsAction({
    page,
    statuses: TAB_STATUSES[tab],
    q,
  });

  const rows: TripRow[] = trips.map((trip) => ({
    id: trip.id,
    tripNumber: trip.tripNumber,
    customerName: trip.customer.name,
    vehicleNumber: trip.vehicle.vehicleNumber,
    driverName: trip.driver.fullName,
    routeName: trip.route?.name ?? null,
    itemCount: trip.items.length,
    departureAt: trip.departureAt ? format(trip.departureAt, "dd MMM yyyy HH:mm") : null,
    status: trip.status,
    eligibilityOverride: trip.eligibilityOverride,
  }));

  const canCreate = hasPermission(user, "TRIP_CREATE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dispatch"
        description="Trips currently in progress — from creation through delivery and return."
        actions={
          canCreate ? (
            <Button size="sm" asChild>
              <Link href="/dispatch/trips/new">
                <Plus className="h-4 w-4" /> New Trip
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "active" ? "/dispatch" : `/dispatch?tab=${t.value}`}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <TableSearchInput placeholder="Search by trip number, customer or vehicle..." />

      <TripsTable data={rows} pagination={pagination} />
    </div>
  );
}
