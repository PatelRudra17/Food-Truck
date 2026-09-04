"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Archive, RotateCcw, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { WarehouseFormDialog, type ManagerOption } from "@/components/warehouses/warehouse-form-dialog";
import { archiveWarehouseAction, restoreWarehouseAction } from "@/lib/actions/warehouse-actions";

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  contact: string | null;
  status: string;
  managerId: string | null;
  managerName: string | null;
  itemCount: number;
  locationCount: number;
};

export function WarehousesClient({
  warehouses,
  managers,
  canCreate,
  canEdit,
  canArchive,
}: {
  warehouses: WarehouseRow[];
  managers: ManagerOption[];
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate && (
          <WarehouseFormDialog
            trigger={
              <Button size="sm">
                <Plus /> New Warehouse
              </Button>
            }
            managers={managers}
            onSaved={refresh}
          />
        )}
      </div>

      {warehouses.length === 0 ? (
        <EmptyState icon={WarehouseIcon} title="No warehouses yet" description="Add your first warehouse to get started." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Locations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <Link href={`/warehouses/${w.id}`} className="hover:underline">
                      {w.code}
                    </Link>
                  </TableCell>
                  <TableCell>{w.name}</TableCell>
                  <TableCell className="text-muted-foreground">{w.managerName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{w.contact ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{w.itemCount}</TableCell>
                  <TableCell className="text-right tabular-nums">{w.locationCount}</TableCell>
                  <TableCell>
                    <StatusBadge status={w.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {canEdit && (
                        <WarehouseFormDialog
                          trigger={
                            <Button variant="outline" size="icon-sm">
                              <Pencil />
                            </Button>
                          }
                          managers={managers}
                          editing={w}
                          onSaved={refresh}
                        />
                      )}
                      {canArchive &&
                        (w.status === "ACTIVE" ? (
                          <ConfirmDialog
                            trigger={
                              <Button variant="outline" size="icon-sm">
                                <Archive />
                              </Button>
                            }
                            title="Archive warehouse?"
                            description={`"${w.name}" will be marked inactive.`}
                            confirmLabel="Archive"
                            destructive
                            onConfirm={() => archiveWarehouseAction(w.id)}
                            onSuccess={refresh}
                          />
                        ) : (
                          <ConfirmDialog
                            trigger={
                              <Button variant="outline" size="icon-sm">
                                <RotateCcw />
                              </Button>
                            }
                            title="Restore warehouse?"
                            description={`"${w.name}" will become active again.`}
                            confirmLabel="Restore"
                            onConfirm={() => restoreWarehouseAction(w.id)}
                            onSuccess={refresh}
                          />
                        ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
