"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive, RotateCcw, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RouteClusterFormDialog, type RouteClusterEditing } from "@/components/routes/route-cluster-form-dialog";
import { archiveRouteClusterAction, reactivateRouteClusterAction } from "@/lib/actions/route-actions";

export type RouteClusterRow = RouteClusterEditing & { routeCount: number };

export function ManageClustersDialog({
  trigger,
  clusters,
  canCreate,
  canEdit,
  canArchive,
}: {
  trigger: ReactNode;
  clusters: RouteClusterRow[];
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Route Clusters</DialogTitle>
          <DialogDescription>Group routes for planning, dispatch and reporting.</DialogDescription>
        </DialogHeader>

        {canCreate && (
          <div className="flex justify-end">
            <RouteClusterFormDialog
              trigger={
                <Button size="sm">
                  <Plus /> New Cluster
                </Button>
              }
              onSaved={refresh}
            />
          </div>
        )}

        {clusters.length === 0 ? (
          <EmptyState icon={Layers} title="No clusters yet" description="Create a cluster to group related routes." />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Routes</TableHead>
                  <TableHead>Status</TableHead>
                  {(canEdit || canArchive) && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.routeCount}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    {(canEdit || canArchive) && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canEdit && (
                            <RouteClusterFormDialog
                              trigger={
                                <Button variant="outline" size="icon-sm">
                                  <Pencil />
                                </Button>
                              }
                              editing={c}
                              onSaved={refresh}
                            />
                          )}
                          {canArchive &&
                            (c.status === "ACTIVE" ? (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="icon-sm">
                                    <Archive />
                                  </Button>
                                }
                                title="Archive cluster?"
                                description={`"${c.name}" will be marked inactive. Its routes are unaffected.`}
                                confirmLabel="Archive"
                                destructive
                                onConfirm={() => archiveRouteClusterAction(c.id)}
                                onSuccess={refresh}
                              />
                            ) : (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="icon-sm">
                                    <RotateCcw />
                                  </Button>
                                }
                                title="Restore cluster?"
                                description={`"${c.name}" will become active again.`}
                                confirmLabel="Restore"
                                onConfirm={() => reactivateRouteClusterAction(c.id)}
                                onSuccess={refresh}
                              />
                            ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
