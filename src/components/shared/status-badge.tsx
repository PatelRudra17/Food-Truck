import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_MAP: Record<string, string> = {
  // neutral / draft
  DRAFT: "bg-muted text-muted-foreground border-transparent",
  UNVERIFIED: "bg-muted text-muted-foreground border-transparent",
  INACTIVE: "bg-muted text-muted-foreground border-transparent",
  UP_TO_DATE: "bg-muted text-muted-foreground border-transparent",

  // pending / warning
  PENDING: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  REQUESTED: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  WARNING: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  DUE_SOON: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  DUE: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  ON_TRIP: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",
  OUTSIDE: "bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950 dark:text-amber-300",

  // positive / success
  APPROVED: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  RECEIVED: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  ISSUED: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  DISPATCHED: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  VERIFIED: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  AVAILABLE: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  NORMAL: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  UP: "bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950 dark:text-emerald-300",
  INSIDE: "bg-sky-100 text-sky-800 border-transparent dark:bg-sky-950 dark:text-sky-300",

  // negative / critical
  REJECTED: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  CANCELLED: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  OVERDUE: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  CRITICAL: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  EXPIRED: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
  MAINTENANCE: "bg-red-100 text-red-800 border-transparent dark:bg-red-950 dark:text-red-300",
};

function humanize(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = TONE_MAP[status] ?? "bg-secondary text-secondary-foreground border-transparent";
  return (
    <Badge variant="outline" className={cn(tone, "font-medium", className)}>
      {humanize(status)}
    </Badge>
  );
}
