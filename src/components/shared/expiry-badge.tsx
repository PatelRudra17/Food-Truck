import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getExpiryStatus, type ExpiryStatus } from "@/lib/expiry";

const TONE: Record<Exclude<ExpiryStatus, "NONE">, string> = {
  EXPIRED: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  DUE_SOON: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  VALID: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
};

const LABEL: Record<Exclude<ExpiryStatus, "NONE">, string> = {
  EXPIRED: "Expired",
  DUE_SOON: "Expiring Soon",
  VALID: "Valid",
};

/** Renders a colored badge for a document/master expiry date. Renders a dash if no date is set. */
export function ExpiryBadge({
  date,
  dueSoonDays,
  className,
}: {
  date: Date | string | null | undefined;
  dueSoonDays?: number;
  className?: string;
}) {
  const status = getExpiryStatus(date, dueSoonDays);
  if (status === "NONE") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <Badge variant="outline" className={cn(TONE[status], "font-medium", className)}>
      {LABEL[status]}
    </Badge>
  );
}

/** Small colored dot (no label) for compact list-view expiry flags, wrapped in a tooltip by the caller. */
export function ExpiryDot({ status }: { status: Exclude<ExpiryStatus, "NONE"> | "NONE" }) {
  if (status === "NONE") return null;
  const dotColor =
    status === "EXPIRED" ? "bg-red-500" : status === "DUE_SOON" ? "bg-amber-500" : "bg-emerald-500";
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", dotColor)} />;
}
