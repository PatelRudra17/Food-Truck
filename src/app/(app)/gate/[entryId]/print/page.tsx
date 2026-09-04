import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { getGateEntryForPrint } from "@/lib/services/gate";
import { PrintButton } from "./print-button";

export const metadata = { title: "Gate Pass" };

export default async function GatePassPrintPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  await requirePermission("GATE_ENTRY_PRINT");
  const { entryId } = await params;
  const entry = await getGateEntryForPrint(entryId);
  if (!entry) notFound();

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #gate-pass-print, #gate-pass-print * { visibility: visible; }
          #gate-pass-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
      <div id="gate-pass-print" className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-center justify-between print:hidden">
          <h1 className="text-xl font-semibold">Gate Pass — {entry.gateEntryNumber}</h1>
          <PrintButton />
        </div>

        <div className="space-y-4 rounded-lg border p-6">
          <div className="text-center">
            <h2 className="text-lg font-bold uppercase tracking-wide">Vehicle Gate Pass</h2>
            <p className="text-sm text-muted-foreground">Gate Entry #: {entry.gateEntryNumber}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Vehicle</dt>
              <dd className="font-medium">
                {entry.vehicle.vehicleNumber} ({entry.vehicle.vehicleType})
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Driver</dt>
              <dd className="font-medium">
                {entry.driver.fullName} — {entry.driver.mobile}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Supplier</dt>
              <dd className="font-medium">{entry.supplier?.companyName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Security Staff</dt>
              <dd className="font-medium">{entry.securityStaff.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Purpose</dt>
              <dd className="font-medium">{entry.purpose ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Material</dt>
              <dd className="font-medium">{entry.material ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Time In</dt>
              <dd className="font-medium">{format(entry.timeIn, "dd MMM yyyy, HH:mm")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{entry.status === "INSIDE" ? "Inside" : "Exited"}</dd>
            </div>
          </dl>

          {entry.remarks && (
            <p className="text-sm">
              <span className="text-muted-foreground">Remarks: </span>
              {entry.remarks}
            </p>
          )}

          {entry.exit && (
            <>
              <hr />
              <h3 className="font-semibold">Exit Details</h3>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Gate Exit #</dt>
                  <dd className="font-medium">{entry.exit.gateExitNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Time Out</dt>
                  <dd className="font-medium">{format(entry.exit.timeOut, "dd MMM yyyy, HH:mm")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Destination</dt>
                  <dd className="font-medium">{entry.exit.destination ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Receiver</dt>
                  <dd className="font-medium">{entry.exit.receiver ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total Time Inside</dt>
                  <dd className="font-medium">{entry.exit.totalTimeInsideMinutes} minutes</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
