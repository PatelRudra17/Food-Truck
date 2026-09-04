"use client";

import { useRouter } from "next/navigation";
import { type LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { MoreHorizontal, Pencil, Archive, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RouteFormDialog, type ClusterOption, type RouteEditing } from "@/components/routes/route-form-dialog";
import { archiveRouteAction, reactivateRouteAction } from "@/lib/actions/route-actions";

export type RouteRow = RouteEditing & { clusterName: string | null };

export function RoutesTable({
  data,
  pagination,
  clusters,
  canEdit,
  canArchive,
}: {
  data: RouteRow[];
  pagination: PaginationMeta;
  clusters: ClusterOption[];
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const onChanged = () => router.refresh();

  const columns: ColumnDef<RouteRow>[] = [
    { accessorKey: "routeNumber", header: "Route #" },
    { accessorKey: "name", header: "Name" },
    {
      id: "path",
      header: "Path",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.startLocation} → {row.original.destination}
        </span>
      ),
    },
    {
      accessorKey: "clusterName",
      header: "Cluster",
      cell: ({ row }) => row.original.clusterName ?? "—",
    },
    {
      accessorKey: "estimatedDistanceKm",
      header: "Distance (km)",
      cell: ({ row }) =>
        row.original.estimatedDistanceKm != null ? row.original.estimatedDistanceKm.toLocaleString() : "—",
    },
    {
      accessorKey: "estimatedTimeMinutes",
      header: "Time (min)",
      cell: ({ row }) =>
        row.original.estimatedTimeMinutes != null ? row.original.estimatedTimeMinutes.toLocaleString() : "—",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
  ];

  if (canEdit || canArchive) {
    columns.push({
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <RouteFormDialog
                  clusters={clusters}
                  editing={row.original}
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  }
                  onSaved={onChanged}
                />
              )}
              {canArchive && row.original.status === "ACTIVE" && (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Archive className="mr-2 h-4 w-4" /> Archive
                    </DropdownMenuItem>
                  }
                  title="Archive route?"
                  description={`"${row.original.name}" will be marked inactive.`}
                  confirmLabel="Archive"
                  destructive
                  onConfirm={() => archiveRouteAction(row.original.id)}
                  onSuccess={onChanged}
                />
              )}
              {canArchive && row.original.status === "INACTIVE" && (
                <ConfirmDialog
                  trigger={
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <RotateCcw className="mr-2 h-4 w-4" /> Restore
                    </DropdownMenuItem>
                  }
                  title="Restore route?"
                  description={`"${row.original.name}" will become active again.`}
                  confirmLabel="Restore"
                  onConfirm={() => reactivateRouteAction(row.original.id)}
                  onSuccess={onChanged}
                />
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    });
  }

  return (
    <DataTable
      columns={columns}
      data={data}
      pagination={pagination}
      emptyTitle="No routes found."
      emptyDescription="Create your first delivery route to get started."
    />
  );
}
