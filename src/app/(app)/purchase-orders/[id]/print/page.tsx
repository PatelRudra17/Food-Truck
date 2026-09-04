import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PrintButton } from "@/components/purchase-orders/print-button";

export const metadata = { title: "Print Purchase Order" };

export default async function PurchaseOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("PURCHASE_ORDER_PRINT");
  const { id } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      items: { include: { item: { select: { name: true, sku: true, unit: true } } } },
    },
  });
  if (!po) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <style>{`
        @media print {
          aside, header { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="mb-6 flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">Purchase Order</h1>
          <p className="text-sm text-neutral-600">{po.poNumber}</p>
        </div>
        <div className="text-right text-sm">
          <p>Date: {format(po.date, "dd MMM yyyy")}</p>
          <p>Status: {po.status.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 font-medium">Supplier</p>
          <p>{po.supplier.companyName}</p>
          <p className="text-neutral-600">{po.supplier.address ?? ""}</p>
          <p className="text-neutral-600">GST: {po.supplier.gstNumber ?? "—"}</p>
          <p className="text-neutral-600">Phone: {po.supplier.phone ?? "—"}</p>
        </div>
        <div>
          <p className="mb-1 font-medium">Order Info</p>
          <p>Expected Delivery: {po.expectedDelivery ? format(po.expectedDelivery, "dd MMM yyyy") : "—"}</p>
          <p>Created By: {po.createdBy.name}</p>
          <p>Approved By: {po.approvedBy?.name ?? "—"}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1.5">Item</th>
            <th className="py-1.5 text-right">Qty</th>
            <th className="py-1.5 text-right">Rate</th>
            <th className="py-1.5 text-right">Tax %</th>
            <th className="py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {po.items.map((line) => (
            <tr key={line.id} className="border-b border-neutral-300">
              <td className="py-1.5">
                {line.item.name} <span className="text-neutral-500">({line.item.sku})</span>
              </td>
              <td className="py-1.5 text-right">
                {Number(line.quantity).toLocaleString()} {line.item.unit}
              </td>
              <td className="py-1.5 text-right">{Number(line.rate).toLocaleString()}</td>
              <td className="py-1.5 text-right">{line.taxPercent ? Number(line.taxPercent) : 0}</td>
              <td className="py-1.5 text-right">{Number(line.total).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-3 text-right font-medium">
              Grand Total
            </td>
            <td className="pt-3 text-right font-semibold">{Number(po.totalAmount).toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      {po.remarks && (
        <div className="mt-6 text-sm">
          <p className="font-medium">Remarks</p>
          <p className="text-neutral-700">{po.remarks}</p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-2 gap-6 text-sm">
        <div className="border-t border-neutral-400 pt-2">Authorized Signatory</div>
        <div className="border-t border-neutral-400 pt-2">Supplier Acknowledgement</div>
      </div>
    </div>
  );
}
