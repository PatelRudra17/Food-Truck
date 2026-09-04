"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CalendarClock } from "lucide-react";
import { ATTENDANCE_STATUSES } from "@/lib/validators/attendance";
import { markAttendanceAction } from "@/lib/actions/attendance-actions";

export type AttendanceGridRowInput = {
  personType: "EMPLOYEE" | "LABOUR";
  personId: string;
  code: string;
  name: string;
  group: string | null;
  shiftId: string | null;
  shiftName: string | null;
  attendanceId: string | null;
  status: "PRESENT" | "ABSENT" | "HALF_DAY" | null;
  overtimeHours: number | null;
  remarks: string | null;
};

function AttendanceRowEditor({ date, row }: { date: string; row: AttendanceGridRowInput }) {
  const router = useRouter();
  const [status, setStatus] = useState<"PRESENT" | "ABSENT" | "HALF_DAY">(row.status ?? "PRESENT");
  const [overtimeHours, setOvertimeHours] = useState(row.overtimeHours ? String(row.overtimeHours) : "0");
  const [remarks, setRemarks] = useState(row.remarks ?? "");
  const [isPending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  function handleSave() {
    startTransition(async () => {
      const result = await markAttendanceAction({
        date,
        employeeId: row.personType === "EMPLOYEE" ? row.personId : undefined,
        labourId: row.personType === "LABOUR" ? row.personId : undefined,
        shiftId: row.shiftId ?? undefined,
        status,
        overtimeHours: overtimeHours || "0",
        remarks,
      });
      if (result.ok) {
        toast.success(`${row.name} marked ${status.replaceAll("_", " ").toLowerCase()}.`);
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const alreadyMarked = Boolean(row.attendanceId) && !dirty;

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <div className="font-medium">{row.name}</div>
        <div className="text-xs text-muted-foreground">{row.code}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {row.personType === "EMPLOYEE" ? "Employee" : "Labour"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.group ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{row.shiftName ?? "—"}</TableCell>
      <TableCell className="min-w-[140px]">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as "PRESENT" | "ABSENT" | "HALF_DAY");
            setDirty(true);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ATTENDANCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-[90px]">
        <Input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={overtimeHours}
          onChange={(e) => {
            setOvertimeHours(e.target.value);
            setDirty(true);
          }}
          className="h-8"
        />
      </TableCell>
      <TableCell className="min-w-[160px]">
        <Input
          value={remarks}
          onChange={(e) => {
            setRemarks(e.target.value);
            setDirty(true);
          }}
          placeholder="Optional"
          className="h-8"
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {alreadyMarked ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={row.status!} />
            <Button size="sm" variant="ghost" onClick={() => setDirty(true)}>
              Edit
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function AttendanceGrid({ date, rows }: { date: string; rows: AttendanceGridRowInput[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No active employees or labour match these filters."
        description="Try adjusting the filters above."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Department / Work Type</TableHead>
            <TableHead>Shift</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Overtime (hrs)</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <AttendanceRowEditor key={`${row.personType}-${row.personId}`} date={date} row={row} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
