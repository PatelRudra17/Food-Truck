import { Plus, Layers } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta, isOneOf } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { Button } from "@/components/ui/button";
import { RouteFormDialog } from "@/components/routes/route-form-dialog";
import { ManageClustersDialog } from "@/components/routes/manage-clusters-dialog";
import { RoutesTable } from "@/components/routes/routes-table";

export const metadata = { title: "Routes" };

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("ROUTE_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const pagination = paginationSchema.parse({ page: params.page, pageSize: params.pageSize });
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const clusterId = typeof params.clusterId === "string" ? params.clusterId : undefined;

  const where: Prisma.RouteWhereInput = {
    ...(isOneOf(status, ["ACTIVE", "INACTIVE"] as const) ? { status } : {}),
    ...(clusterId ? (clusterId === "none" ? { routeClusterId: null } : { routeClusterId: clusterId }) : {}),
    ...(q
      ? {
          OR: [
            { routeNumber: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { startLocation: { contains: q, mode: "insensitive" } },
            { destination: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, routes, clusters] = await Promise.all([
    prisma.route.count({ where }),
    prisma.route.findMany({
      where,
      orderBy: { routeNumber: "asc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      include: { routeCluster: { select: { id: true, name: true } } },
    }),
    prisma.routeCluster.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { routes: true } } },
    }),
  ]);

  const rows = routes.map((r) => ({
    id: r.id,
    routeNumber: r.routeNumber,
    name: r.name,
    startLocation: r.startLocation,
    destination: r.destination,
    routeClusterId: r.routeClusterId,
    clusterName: r.routeCluster?.name ?? null,
    estimatedDistanceKm: r.estimatedDistanceKm != null ? Number(r.estimatedDistanceKm) : null,
    estimatedTimeMinutes: r.estimatedTimeMinutes,
    status: r.status,
  }));

  const clusterOptions = clusters.map((c) => ({ id: c.id, name: c.name }));
  const clusterRows = clusters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status,
    routeCount: c._count.routes,
  }));

  const canCreate = hasPermission(user, "ROUTE_CREATE");
  const canEdit = hasPermission(user, "ROUTE_EDIT");
  const canArchive = hasPermission(user, "ROUTE_ARCHIVE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Routes"
        description="Manage delivery routes and the clusters they belong to."
        actions={
          <>
            <ManageClustersDialog
              trigger={
                <Button size="sm" variant="outline">
                  <Layers /> Manage Clusters
                </Button>
              }
              clusters={clusterRows}
              canCreate={canCreate}
              canEdit={canEdit}
              canArchive={canArchive}
            />
            {canCreate && (
              <RouteFormDialog
                clusters={clusterOptions}
                trigger={
                  <Button size="sm">
                    <Plus /> New Route
                  </Button>
                }
              />
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by route #, name, or location..." />
        <StatusFilterSelect
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
        <TableFilterSelect
          paramKey="clusterId"
          placeholder="All clusters"
          options={[
            { value: "none", label: "Unclustered" },
            ...clusterOptions.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      <RoutesTable
        data={rows}
        pagination={paginationMeta(total, pagination)}
        clusters={clusterOptions}
        canEdit={canEdit}
        canArchive={canArchive}
      />
    </div>
  );
}
