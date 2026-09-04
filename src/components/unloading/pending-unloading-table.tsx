"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { PackageOpen } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { startUnloadingAction } from "@/lib/actions/unloading-actions";

export type PendingUnloadingRow = {
  gateEntryId: string;
  gateEntryNumber: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  supplierName: string | null;
  timeIn: Date;
  procurementNumbers: string[];
};

export function PendingUnloadingTable({
  rows,
  canManage,
}: {
  rows: PendingUnloadingRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="No vehicles awaiting unloading"
        description="Trucks with a linked procurement that are still inside will appear here until unloading starts."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Gate Entry #</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Procurement(s)</TableHead>
            <TableHead>Arrived</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.gateEntryId}>
              <TableCell className="font-medium">{row.gateEntryNumber}</TableCell>
              <TableCell>
                <Link href={`/vehicles/${row.vehicleId}`} className="hover:underline">
                  {row.vehicleNumber}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/drivers/${row.driverId}`} className="hover:underline">
                  {row.driverName}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{row.supplierName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{row.procurementNumbers.join(", ")}</TableCell>
              <TableCell>{format(row.timeIn, "dd MMM yyyy, HH:mm")}</TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <ConfirmDialog
                    trigger={
                      <Button size="sm">
                        <PackageOpen className="h-4 w-4" /> Start Unloading
                      </Button>
                    }
                    title="Start unloading?"
                    description={`Unloading will begin for ${row.vehicleNumber} (${row.gateEntryNumber}).`}
                    confirmLabel="Start"
                    onConfirm={() => startUnloadingAction(row.gateEntryId)}
                    onSuccess={refresh}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
