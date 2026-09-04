import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader2 } from "lucide-react";
import { CompleteUnloadingDialog } from "./complete-unloading-dialog";

export type InProgressUnloadingRow = {
  id: string;
  gateEntryNumber: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  supplierName: string | null;
  unloadingStartAt: Date;
};

export function InProgressUnloadingTable({
  rows,
  canManage,
}: {
  rows: InProgressUnloadingRow[];
  canManage: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Loader2}
        title="No unloading in progress"
        description="Trucks whose unloading has started will appear here until it is completed."
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
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
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
              <TableCell>{format(row.unloadingStartAt, "dd MMM yyyy, HH:mm")}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(row.unloadingStartAt, { addSuffix: false })}
              </TableCell>
              {canManage && (
                <TableCell className="text-right">
                  <CompleteUnloadingDialog unloadingId={row.id} vehicleNumber={row.vehicleNumber} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
