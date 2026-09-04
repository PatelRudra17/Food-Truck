import { PackageCheck, Truck, Users, RotateCcw, AlertTriangle, HelpCircle } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";

export type CrateStatusCounts = Partial<
  Record<"AVAILABLE" | "LOADED" | "WITH_CUSTOMER" | "RETURNED" | "DAMAGED" | "MISSING", number>
>;

export function CrateKpiRow({ counts }: { counts: CrateStatusCounts }) {
  const items = [
    { key: "AVAILABLE", label: "Available", icon: PackageCheck, tone: "default" as const },
    { key: "LOADED", label: "Loaded", icon: Truck, tone: "default" as const },
    { key: "WITH_CUSTOMER", label: "With Customer", icon: Users, tone: "default" as const },
    { key: "RETURNED", label: "Returned", icon: RotateCcw, tone: "default" as const },
    { key: "DAMAGED", label: "Damaged", icon: AlertTriangle, tone: "danger" as const },
    { key: "MISSING", label: "Missing", icon: HelpCircle, tone: "danger" as const },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <KpiCard
          key={item.key}
          label={item.label}
          value={(counts[item.key as keyof CrateStatusCounts] ?? 0).toLocaleString()}
          icon={item.icon}
          tone={item.tone}
          href={`/crates?status=${item.key}`}
        />
      ))}
    </div>
  );
}
