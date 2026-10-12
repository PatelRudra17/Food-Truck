import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/shared/print-button";

export const metadata = { title: "Print Stock Outward" };

export default async function PrintStockOutwardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("STOCK_OUTWARD_PRINT");
  const { id } = await params;

  const outward = await prisma.stockOutward.findUnique({
    where: { id },
    include: {
      warehouse: true,
      vehicle: true,
      driver: true,
      requestedBy: true,
      approvedBy: true,
      items: { include: { item: true }, orderBy: { id: "asc" } },
    },
  });
  if (!outward) notFound();

  const totalQty = outward.items.reduce((sum, i) => sum + Number(i.requestedQty), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 print:p-0">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          .no-print { display: none !important; }
          aside, header { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="no-print flex justify-end">
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold">Stock Outward Slip</h1>
          <p className="text-sm text-muted-foreground">Enterprise Inventory &amp; Logistics</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{outward.outwardNumber}</p>
          <p className="text-sm text-muted-foreground">{format(outward.date, "dd MMM yyyy")}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Warehouse</p>
          <p className="font-medium">{outward.warehouse.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Status</p>
          <p className="font-medium">{outward.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Department / Project</p>
          <p className="font-medium">{[outward.department, outward.project].filter(Boolean).join(" / ") || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Purpose</p>
          <p className="font-medium">{outward.purpose ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Destination</p>
          <p className="font-medium">{outward.destination ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Receiver</p>
          <p className="font-medium">{outward.receiver ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Vehicle</p>
          <p className="font-medium">{outward.vehicle?.vehicleNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Driver</p>
          <p className="font-medium">{outward.driver?.fullName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Requested By</p>
          <p className="font-medium">{outward.requestedBy.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Approved By</p>
          <p className="font-medium">{outward.approvedBy?.name ?? "—"}</p>
        </div>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">#</th>
            <th className="py-2">Item</th>
            <th className="py-2">Batch / Serial</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2">Unit</th>
          </tr>
        </thead>
        <tbody>
          {outward.items.map((line, idx) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{idx + 1}</td>
              <td className="py-2">
                {line.item.name}
                <div className="text-xs text-muted-foreground">{line.item.sku}</div>
              </td>
              <td className="py-2">
                {[line.batchNumber, line.serialNumber].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="py-2 text-right">{Number(line.requestedQty).toLocaleString()}</td>
              <td className="py-2">{line.unit}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={3} className="py-2 text-right">
              Total
            </td>
            <td className="py-2 text-right">{totalQty.toLocaleString()}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      {outward.remarks && (
        <div className="text-sm">
          <p className="text-xs uppercase text-muted-foreground">Remarks</p>
          <p>{outward.remarks}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 pt-8 text-sm">
        <div className="border-t pt-2">Issued By</div>
        <div className="border-t pt-2">Received By</div>
      </div>
    </div>
  );
}
