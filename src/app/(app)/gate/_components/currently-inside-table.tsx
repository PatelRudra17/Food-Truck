"use client";

import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordOutDialog } from "./record-out-dialog";
import { Printer, Inbox } from "lucide-react";

export type InsideRow = {
  id: string;
  gateEntryNumber: string;
  vehicleId: string;
  vehicleNumber: string;
  driverId: string;
  driverName: string;
  supplierName: string | null;
  purpose: string | null;
  material: string | null;
  timeIn: Date;
};

export function CurrentlyInsideTable({
  rows,
  canRecordOut,
  canPrint,
}: {
  rows: InsideRow[];
  canRecordOut: boolean;
  canPrint: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No vehicles currently inside"
        description="Vehicles recorded in at the gate will appear here until they exit."
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
            <TableHead>Purpose / Material</TableHead>
            <TableHead>Time In</TableHead>
            <TableHead>Inside For</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell className="text-muted-foreground">
                {[row.purpose, row.material].filter(Boolean).join(" · ") || "—"}
              </TableCell>
              <TableCell>{format(row.timeIn, "dd MMM yyyy, HH:mm")}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(row.timeIn, { addSuffix: false })}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  {canPrint && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/gate/${row.id}/print`}>
                        <Printer /> Print
                      </Link>
                    </Button>
                  )}
                  {canRecordOut && (
                    <RecordOutDialog gateEntryId={row.id} vehicleNumber={row.vehicleNumber} />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
