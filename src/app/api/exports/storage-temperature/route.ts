import { NextRequest } from "next/server";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";
import { writeAuditLog } from "@/lib/audit";
import { temperatureLogFilterSchema } from "@/lib/validators/storage-temperature";
import { getTemperatureLogListAll, locationLabel } from "@/lib/services/storage-temperature-metrics";

export async function GET(request: NextRequest) {
  const user = await requirePermission("STORAGE_TEMPERATURE_EXPORT");

  const sp = request.nextUrl.searchParams;
  const filters = temperatureLogFilterSchema.parse({
    warehouseId: sp.get("warehouseId") || undefined,
    locationId: sp.get("locationId") || undefined,
    itemId: sp.get("itemId") || undefined,
    batchNumber: sp.get("batchNumber") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
  });

  const logs = await getTemperatureLogListAll(filters);

  const rows = logs.map((l) => [
    format(l.recordedAt, "dd MMM yyyy HH:mm"),
    l.item.name,
    l.item.sku,
    l.batchNumber ?? "",
    l.warehouse.name,
    locationLabel(l.location) ?? "",
    Number(l.recordedTempC),
    l.item.storageMinTempC != null ? Number(l.item.storageMinTempC) : "",
    l.item.storageMaxTempC != null ? Number(l.item.storageMaxTempC) : "",
    l.status,
    l.source,
    l.recordedBy.name,
  ]);

  const buffer = await buildExcelBuffer({
    sheetName: "Temperature Logs",
    headers: [
      "Recorded At",
      "Item",
      "SKU",
      "Batch",
      "Warehouse",
      "Location",
      "Temperature (°C)",
      "Min (°C)",
      "Max (°C)",
      "Status",
      "Source",
      "Recorded By",
    ],
    rows,
  });

  await writeAuditLog({
    userId: user.id,
    action: "EXPORT",
    entityType: "StorageTemperatureLog",
    newValues: { filters: Object.fromEntries(sp.entries()), rowCount: rows.length },
  });

  return new Response(new Uint8Array(buffer), {
    headers: fileResponseHeaders(
      `storage-temperature-${format(new Date(), "yyyyMMdd-HHmmss")}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
  });
}
