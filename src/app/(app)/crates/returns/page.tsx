import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { CrateReturnFormDialog } from "@/components/crate-returns/crate-return-form";
import { CrateReturnsTable, type CrateReturnRow } from "@/components/crate-returns/crate-returns-table";

export const metadata = { title: "Crate Returns" };

export default async function CrateReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("CRATE_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const pagination = paginationSchema.parse({ page: params.page, pageSize: params.pageSize });
  const q = typeof params.q === "string" ? params.q : undefined;

  const where: Prisma.CrateReturnWhereInput = q
    ? {
        OR: [
          { returnNumber: { contains: q, mode: "insensitive" } },
          { trip: { tripNumber: { contains: q, mode: "insensitive" } } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const [total, returns, eligibleTrips, candidateCrates] = await Promise.all([
    prisma.crateReturn.count({ where }),
    prisma.crateReturn.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: {
        trip: { select: { id: true, tripNumber: true } },
        customer: { select: { name: true } },
      },
    }),
    prisma.trip.findMany({
      where: { status: { in: ["DISPATCHED", "DELIVERED", "RETURNED"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        tripNumber: true,
        customer: { select: { id: true, name: true } },
        items: { select: { cratesCount: true } },
      },
    }),
    prisma.crate.findMany({
      where: { customerId: { not: null }, status: { in: ["WITH_CUSTOMER", "LOADED"] } },
      orderBy: { crateCode: "asc" },
      select: { id: true, crateCode: true, customerId: true, status: true },
    }),
  ]);

  const rows: CrateReturnRow[] = returns.map((cr) => {
    const pending = cr.cratesDispatched - cr.cratesReturned - cr.cratesDamaged - cr.cratesMissing;
    return {
      id: cr.id,
      tripId: cr.trip.id,
      returnNumber: cr.returnNumber,
      tripNumber: cr.trip.tripNumber,
      customerName: cr.customer.name,
      cratesDispatched: cr.cratesDispatched,
      cratesReturned: cr.cratesReturned,
      cratesDamaged: cr.cratesDamaged,
      cratesMissing: cr.cratesMissing,
      pending: Math.max(0, pending),
      returnDate: cr.returnDate ? format(cr.returnDate, "dd MMM yyyy") : null,
    };
  });

  const canCreate = hasPermission(user, "CRATE_CREATE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Crate Returns"
        description="Record crates returned, damaged, or missing when a vehicle comes back from a customer delivery."
        actions={
          canCreate ? (
            <CrateReturnFormDialog
              trips={eligibleTrips.map((t) => ({
                id: t.id,
                tripNumber: t.tripNumber,
                customerId: t.customer.id,
                customerName: t.customer.name,
                suggestedCratesDispatched: t.items.reduce((sum, i) => sum + (i.cratesCount ?? 0), 0),
              }))}
              crates={candidateCrates}
            />
          ) : undefined
        }
      />

      <TableSearchInput placeholder="Search by return number, trip or customer..." />

      <CrateReturnsTable data={rows} pagination={paginationMeta(total, pagination)} />
    </div>
  );
}
