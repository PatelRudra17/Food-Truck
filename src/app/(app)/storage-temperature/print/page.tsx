import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/shared/print-button";
import { temperatureLogFilterSchema } from "@/lib/validators/storage-temperature";
import { getTemperatureLogListAll, locationLabel } from "@/lib/services/storage-temperature-metrics";

export const metadata = { title: "Print Storage Temperature" };

function flat(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PrintStorageTemperaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("STORAGE_TEMPERATURE_VIEW");
  const sp = await searchParams;
  const filters = temperatureLogFilterSchema.parse({
    warehouseId: flat(sp.warehouseId),
    locationId: flat(sp.locationId),
    itemId: flat(sp.itemId),
    batchNumber: flat(sp.batchNumber),
    dateFrom: flat(sp.dateFrom),
    dateTo: flat(sp.dateTo),
  });

  const [logs, warehouse, item] = await Promise.all([
    getTemperatureLogListAll(filters),
    filters.warehouseId ? prisma.warehouse.findUnique({ where: { id: filters.warehouseId }, select: { name: true } }) : null,
    filters.itemId ? prisma.item.findUnique({ where: { id: filters.itemId }, select: { name: true } }) : null,
  ]);

  const filterSummary = [
    warehouse && `Warehouse: ${warehouse.name}`,
    item && `Item: ${item.name}`,
    filters.batchNumber && `Batch: ${filters.batchNumber}`,
    filters.dateFrom && `From: ${filters.dateFrom}`,
    filters.dateTo && `To: ${filters.dateTo}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 print:p-0">
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
          <h1 className="text-xl font-bold">Storage Temperature Log</h1>
          <p className="text-sm text-muted-foreground">Enterprise Inventory &amp; Logistics</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <p>Printed {format(new Date(), "dd MMM yyyy, HH:mm")}</p>
          <p>{logs.length.toLocaleString()} reading(s)</p>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        {filterSummary.length > 0 ? filterSummary.join(" · ") : "All readings"}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Recorded At</th>
            <th className="py-2">Item</th>
            <th className="py-2">Batch</th>
            <th className="py-2">Warehouse / Location</th>
            <th className="py-2 text-right">Temp (°C)</th>
            <th className="py-2 text-right">Range (°C)</th>
            <th className="py-2">Status</th>
            <th className="py-2">Recorded By</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="py-2">{format(l.recordedAt, "dd MMM yyyy HH:mm")}</td>
              <td className="py-2">
                {l.item.name}
                <div className="text-xs text-muted-foreground">{l.item.sku}</div>
              </td>
              <td className="py-2">{l.batchNumber ?? "—"}</td>
              <td className="py-2">
                {l.warehouse.name}
                {locationLabel(l.location) && (
                  <div className="text-xs text-muted-foreground">{locationLabel(l.location)}</div>
                )}
              </td>
              <td className="py-2 text-right">{Number(l.recordedTempC)}</td>
              <td className="py-2 text-right">
                {l.item.storageMinTempC != null && l.item.storageMaxTempC != null
                  ? `${Number(l.item.storageMinTempC)} – ${Number(l.item.storageMaxTempC)}`
                  : "—"}
              </td>
              <td className="py-2">{l.status}</td>
              <td className="py-2">{l.recordedBy.name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {logs.length === 0 && <p className="text-center text-sm text-muted-foreground">No readings match these filters.</p>}
    </div>
  );
}
