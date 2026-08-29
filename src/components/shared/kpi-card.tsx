import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "warning" | "danger";
}) {
  const content = (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 py-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            tone === "warning" && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
            tone === "danger" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
            tone === "default" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}
