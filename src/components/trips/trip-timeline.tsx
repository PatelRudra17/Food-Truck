import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["CREATED", "APPROVED", "LOADING", "LOADED", "DISPATCHED", "DELIVERED", "RETURNED"] as const;

function humanize(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** Traceability view of the 8-status Trip lifecycle. CANCELLED short-circuits the linear flow. */
export function TripTimeline({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <X className="h-4 w-4" /> This trip was cancelled before dispatch.
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STEPS.map((step, i) => {
        const done = currentIndex > i;
        const active = currentIndex === i;
        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                done && "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
                active && "border-primary bg-primary/10 text-primary",
                !done && !active && "border-muted bg-muted text-muted-foreground",
              )}
            >
              {done && <Check className="h-3 w-3" />}
              {humanize(step)}
            </div>
            {i < STEPS.length - 1 && <div className={cn("h-px w-4", done ? "bg-emerald-300" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}
