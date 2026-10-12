import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Truck, User, DoorOpen, ClipboardList, Package, Scissors, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";

export type TraceStep = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  href?: string;
  detail?: ReactNode;
  muted?: boolean;
};

function TimelineStep({ step, isLast }: { step: TraceStep; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            step.muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          }`}
        >
          {step.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className="pb-6">
        <p className="text-sm font-medium">
          {step.href ? (
            <Link href={step.href} className="hover:underline">
              {step.title}
            </Link>
          ) : (
            step.title
          )}
        </p>
        {step.subtitle && <p className="text-sm text-muted-foreground">{step.subtitle}</p>}
        {step.detail && <div className="mt-1 text-sm">{step.detail}</div>}
      </div>
    </div>
  );
}

export type BatchTraceData = {
  supplier: { id: string; companyName: string; code: string };
  vehicle: { id: string; vehicleNumber: string; vehicleType: string } | null;
  driver: { id: string; fullName: string; mobile: string } | null;
  gateEntry: { id: string; gateEntryNumber: string; timeIn: Date; purpose: string | null } | null;
  procurement: { id: string; procurementNumber: string; date: Date; status: string; createdByName: string };
  batch: {
    batchNumber: string;
    itemName: string;
    itemSku: string;
    rawWeight: number;
    declaredWeight: number;
    warehouseName: string;
    status: string;
    date: Date;
  };
  sorting: {
    gradeAWeight: number;
    gradeBWeight: number;
    gradeCWeight: number;
    otherGradeWeight: number;
    wasteWeight: number;
    sortedAt: Date;
  } | null;
  wastages: { id: string; wastageNumber: string; quantity: number; reason: string; date: Date }[];
};

export function BatchTraceView({ data }: { data: BatchTraceData }) {
  const steps: TraceStep[] = [
    {
      icon: <ClipboardList className="h-4 w-4" />,
      title: `Vendor — ${data.supplier.companyName}`,
      subtitle: data.supplier.code,
      href: `/suppliers/${data.supplier.id}`,
    },
  ];

  if (data.vehicle) {
    steps.push({
      icon: <Truck className="h-4 w-4" />,
      title: `Vehicle — ${data.vehicle.vehicleNumber}`,
      subtitle: data.vehicle.vehicleType,
      href: `/vehicles/${data.vehicle.id}`,
    });
  }

  if (data.driver) {
    steps.push({
      icon: <User className="h-4 w-4" />,
      title: `Driver — ${data.driver.fullName}`,
      subtitle: data.driver.mobile,
      href: `/drivers/${data.driver.id}`,
    });
  }

  if (data.gateEntry) {
    steps.push({
      icon: <DoorOpen className="h-4 w-4" />,
      title: `Gate Entry — ${data.gateEntry.gateEntryNumber}`,
      subtitle: `${format(data.gateEntry.timeIn, "dd MMM yyyy, HH:mm")}${
        data.gateEntry.purpose ? ` · ${data.gateEntry.purpose}` : ""
      }`,
    });
  }

  steps.push({
    icon: <ClipboardList className="h-4 w-4" />,
    title: `Procurement — ${data.procurement.procurementNumber}`,
    subtitle: `${format(data.procurement.date, "dd MMM yyyy")} · Created by ${data.procurement.createdByName}`,
    href: `/procurement/${data.procurement.id}`,
    detail: <StatusBadge status={data.procurement.status} />,
  });

  steps.push({
    icon: <Package className="h-4 w-4" />,
    title: `Batch — ${data.batch.batchNumber}`,
    subtitle: `${data.batch.itemName} (${data.batch.itemSku}) · ${data.batch.rawWeight.toLocaleString()} kg raw${
      data.batch.declaredWeight !== data.batch.rawWeight ? ` (declared ${data.batch.declaredWeight.toLocaleString()} kg)` : ""
    } · ${data.batch.warehouseName}`,
    detail: <StatusBadge status={data.batch.status} />,
  });

  if (data.sorting) {
    steps.push({
      icon: <Scissors className="h-4 w-4" />,
      title: "Sorted",
      subtitle: format(data.sorting.sortedAt, "dd MMM yyyy, HH:mm"),
      detail: (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span>Grade A: {data.sorting.gradeAWeight.toLocaleString()} kg</span>
          <span>Grade B: {data.sorting.gradeBWeight.toLocaleString()} kg</span>
          <span>Grade C: {data.sorting.gradeCWeight.toLocaleString()} kg</span>
          <span>Other: {data.sorting.otherGradeWeight.toLocaleString()} kg</span>
          <span>Waste: {data.sorting.wasteWeight.toLocaleString()} kg</span>
        </div>
      ),
    });
  } else {
    steps.push({
      icon: <Scissors className="h-4 w-4" />,
      title: "Sorting",
      subtitle: "Not yet sorted.",
      muted: true,
    });
  }

  if (data.wastages.length > 0) {
    steps.push({
      icon: <Trash2 className="h-4 w-4" />,
      title: `Wastage recorded (${data.wastages.length})`,
      detail: (
        <ul className="space-y-1 text-muted-foreground">
          {data.wastages.map((w) => (
            <li key={w.id}>
              {w.wastageNumber} — {w.quantity.toLocaleString()} kg ({w.reason}) on{" "}
              {format(w.date, "dd MMM yyyy")}
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Traceability</CardTitle>
      </CardHeader>
      <CardContent>
        {steps.map((step, i) => (
          <TimelineStep key={i} step={step} isLast={i === steps.length - 1} />
        ))}
      </CardContent>
    </Card>
  );
}
