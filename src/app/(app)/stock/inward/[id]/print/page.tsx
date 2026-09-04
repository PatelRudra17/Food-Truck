import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/shared/print-button";

export const metadata = { title: "Print Stock Inward" };

export default async function PrintStockInwardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("STOCK_INWARD_PRINT");
  const { id } = await params;

  const inward = await prisma.stockInward.findUnique({
    where: { id },
    include: {
      supplier: true,
      purchaseOrder: true,
      warehouse: true,
      vehicle: true,
      driver: true,
      receivedBy: true,
      items: { include: { item: true }, orderBy: { id: "asc" } },
    },
  });
  if (!inward) notFound();

  const totalQty = inward.items.reduce((sum, i) => sum + Number(i.quantity), 0);
  const totalAmount = inward.items.reduce((sum, i) => sum + (i.total ? Number(i.total) : 0), 0);

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
          <h1 className="text-xl font-bold">Stock Inward Receipt</h1>
          <p className="text-sm text-muted-foreground">Enterprise Inventory &amp; Logistics</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{inward.inwardNumber}</p>
          <p className="text-sm text-muted-foreground">{format(inward.date, "dd MMM yyyy")}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Supplier</p>
          <p className="font-medium">{inward.supplier?.companyName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Warehouse</p>
          <p className="font-medium">{inward.warehouse.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Purchase Order</p>
          <p className="font-medium">{inward.purchaseOrder?.poNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Invoice Number</p>
          <p className="font-medium">{inward.invoiceNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Vehicle</p>
          <p className="font-medium">{inward.vehicle?.vehicleNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Driver</p>
          <p className="font-medium">{inward.driver?.fullName ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Status</p>
          <p className="font-medium">{inward.status}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Created / Received By</p>
          <p className="font-medium">{inward.receivedBy.name}</p>
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
            <th className="py-2 text-right">Rate</th>
            <th className="py-2 text-right">Tax %</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {inward.items.map((line, idx) => (
            <tr key={line.id} className="border-b">
              <td className="py-2">{idx + 1}</td>
              <td className="py-2">
                {line.item.name}
                <div className="text-xs text-muted-foreground">{line.item.sku}</div>
              </td>
              <td className="py-2">
                {[line.batchNumber, line.serialNumber].filter(Boolean).join(" / ") || "—"}
              </td>
              <td className="py-2 text-right">{Number(line.quantity).toLocaleString()}</td>
              <td className="py-2">{line.unit}</td>
              <td className="py-2 text-right">
                {line.rate != null ? Number(line.rate).toLocaleString() : "—"}
              </td>
              <td className="py-2 text-right">
                {line.taxPercent != null ? Number(line.taxPercent).toLocaleString() : "—"}
              </td>
              <td className="py-2 text-right">
                {line.total != null ? Number(line.total).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={3} className="py-2 text-right">
              Totals
            </td>
            <td className="py-2 text-right">{totalQty.toLocaleString()}</td>
            <td />
            <td />
            <td />
            <td className="py-2 text-right">{totalAmount.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      {inward.remarks && (
        <div className="text-sm">
          <p className="text-xs uppercase text-muted-foreground">Remarks</p>
          <p>{inward.remarks}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-8 pt-8 text-sm">
        <div className="border-t pt-2">Received By</div>
        <div className="border-t pt-2">Authorized Signatory</div>
      </div>
    </div>
  );
}
