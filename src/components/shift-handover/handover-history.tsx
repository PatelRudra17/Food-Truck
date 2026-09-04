import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { History } from "lucide-react";

export type HandoverHistoryRow = {
  id: string;
  handoverAt: string;
  shiftName: string;
  previousSupervisorName: string | null;
  newSupervisorName: string | null;
  stockIssuesNote: string | null;
  cleaningStatusNote: string | null;
  crateStatusNote: string | null;
  remarks: string | null;
};

export function HandoverHistory({ rows }: { rows: HandoverHistoryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent handovers</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={History} title="No handovers recorded yet." description="Recorded handovers for this shift will appear here." />
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{r.shiftName}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(r.handoverAt), "dd MMM yyyy HH:mm")}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.previousSupervisorName ?? "Unspecified"} → {r.newSupervisorName ?? "Unspecified"}
                </p>
                <div className="mt-2 space-y-1 text-xs">
                  {r.stockIssuesNote && (
                    <p>
                      <span className="font-medium text-muted-foreground">Stock: </span>
                      {r.stockIssuesNote}
                    </p>
                  )}
                  {r.cleaningStatusNote && (
                    <p>
                      <span className="font-medium text-muted-foreground">Cleaning: </span>
                      {r.cleaningStatusNote}
                    </p>
                  )}
                  {r.crateStatusNote && (
                    <p>
                      <span className="font-medium text-muted-foreground">Crates: </span>
                      {r.crateStatusNote}
                    </p>
                  )}
                  {r.remarks && (
                    <p>
                      <span className="font-medium text-muted-foreground">Remarks: </span>
                      {r.remarks}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
