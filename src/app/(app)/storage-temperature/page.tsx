import Link from "next/link";
import { Thermometer, AlertTriangle, ShieldAlert, Boxes, Download, Printer, Plus } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { paginationSchema, paginationMeta } from "@/lib/validators/common";
import { temperatureLogFilterSchema } from "@/lib/validators/storage-temperature";
import {
  getStorageTemperatureDashboard,
  getTemperatureLogList,
  locationLabel,
} from "@/lib/services/storage-temperature-metrics";
import { RecordTemperatureDialog } from "@/components/storage-temperature/record-temperature-dialog";
import { TemperatureSettingsDialog } from "@/components/storage-temperature/temperature-settings-dialog";
import { TemperatureFiltersBar } from "@/components/storage-temperature/temperature-filters-bar";
import { TemperatureLogTable, type TemperatureLogRow } from "@/components/storage-temperature/temperature-log-table";

export const metadata = { title: "Storage Temperature" };

function flat(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function StorageTemperaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("STORAGE_TEMPERATURE_VIEW");
  const user = await getSessionUser();
  const sp = await searchParams;

  const pagination = paginationSchema.parse({ page: flat(sp.page), pageSize: flat(sp.pageSize) });
  const filters = temperatureLogFilterSchema.parse({
    warehouseId: flat(sp.warehouseId),
    locationId: flat(sp.locationId),
    itemId: flat(sp.itemId),
    batchNumber: flat(sp.batchNumber),
    dateFrom: flat(sp.dateFrom),
    dateTo: flat(sp.dateTo),
  });

  const [dashboard, { rows: logRows, total }, warehouses, locationsRaw, sensitiveItems] = await Promise.all([
    getStorageTemperatureDashboard(),
    getTemperatureLogList(filters, pagination),
    prisma.warehouse.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      orderBy: [{ warehouseId: "asc" }, { rack: "asc" }],
      select: { id: true, warehouseId: true, rack: true, shelf: true, bin: true },
    }),
    prisma.item.findMany({
      where: { isTemperatureSensitive: true, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        unit: true,
        storageMinTempC: true,
        storageMaxTempC: true,
        storageType: true,
        shelfLifeDays: true,
        isTemperatureSensitive: true,
      },
    }),
  ]);

  const canCreate = hasPermission(user, "STORAGE_TEMPERATURE_CREATE");
  const canExport = hasPermission(user, "STORAGE_TEMPERATURE_EXPORT");
  const canEditItem = hasPermission(user, "ITEM_EDIT");

  const locations = locationsRaw.map((l) => ({
    id: l.id,
    warehouseId: l.warehouseId,
    label: locationLabel(l) ?? "Unspecified",
  }));

  const itemOptions = sensitiveItems.map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
    unit: i.unit,
    storageMinTempC: i.storageMinTempC != null ? Number(i.storageMinTempC) : null,
    storageMaxTempC: i.storageMaxTempC != null ? Number(i.storageMaxTempC) : null,
  }));

  const settingsByItemId = new Map(
    sensitiveItems.map((i) => [
      i.id,
      {
        id: i.id,
        name: i.name,
        isTemperatureSensitive: i.isTemperatureSensitive,
        storageMinTempC: i.storageMinTempC != null ? Number(i.storageMinTempC) : null,
        storageMaxTempC: i.storageMaxTempC != null ? Number(i.storageMaxTempC) : null,
        storageType: i.storageType,
        shelfLifeDays: i.shelfLifeDays,
      },
    ]),
  );

  const logTableRows: TemperatureLogRow[] = logRows.map((l) => ({
    id: l.id,
    itemId: l.itemId,
    itemName: l.item.name,
    itemSku: l.item.sku,
    itemUnit: l.item.unit,
    batchNumber: l.batchNumber,
    warehouseName: l.warehouse.name,
    locationLabel: locationLabel(l.location),
    recordedTempC: Number(l.recordedTempC),
    minTempC: l.item.storageMinTempC != null ? Number(l.item.storageMinTempC) : null,
    maxTempC: l.item.storageMaxTempC != null ? Number(l.item.storageMaxTempC) : null,
    status: l.status,
    source: l.source,
    recordedByName: l.recordedBy.name,
    recordedAt: l.recordedAt.toISOString(),
  }));

  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => !!v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage Temperature"
        description="Monitor cold-storage conditions for temperature-sensitive vegetables and produce, and log manual readings."
        actions={
          <>
            {canExport && (
              <Button variant="outline" asChild>
                <a href={`/api/exports/storage-temperature${exportQuery ? `?${exportQuery}` : ""}`}>
                  <Download /> Export
                </a>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/storage-temperature/print${exportQuery ? `?${exportQuery}` : ""}`} target="_blank">
                <Printer /> Print
              </Link>
            </Button>
            {canCreate && (
              <RecordTemperatureDialog
                trigger={
                  <Button size="sm">
                    <Plus /> Record Reading
                  </Button>
                }
                items={itemOptions}
                warehouses={warehouses}
                locations={locations}
              />
            )}
          </>
        }
      />

      {/* Monitoring dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Items Monitored" value={dashboard.itemsMonitoredCount} icon={Boxes} />
        <KpiCard
          label="Active Alerts"
          value={dashboard.alerts.length}
          icon={AlertTriangle}
          tone={dashboard.alerts.length > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Critical"
          value={dashboard.criticalCount}
          icon={ShieldAlert}
          tone={dashboard.criticalCount > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Batches at Risk"
          value={dashboard.batchesAtRisk.length}
          icon={Thermometer}
          tone={dashboard.batchesAtRisk.length > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Storage Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.latestLogs.length === 0 ? (
              <EmptyState
                icon={Thermometer}
                title="No readings recorded yet"
                description="Record a reading to start monitoring."
              />
            ) : (
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Temp</TableHead>
                      <TableHead>Status</TableHead>
                      {canEditItem && <TableHead className="text-right">Settings</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.latestLogs.map((l) => {
                      const settings = settingsByItemId.get(l.item.id);
                      return (
                        <TableRow key={`${l.itemId}-${l.warehouseId}`}>
                          <TableCell>
                            <Link href={`/storage-temperature/${l.itemId}`} className="font-medium hover:underline">
                              {l.item.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{l.warehouse.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(l.recordedTempC)}°C</TableCell>
                          <TableCell>
                            <StatusBadge status={l.status} />
                          </TableCell>
                          {canEditItem && (
                            <TableCell className="text-right">
                              {settings && (
                                <TemperatureSettingsDialog
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      Settings
                                    </Button>
                                  }
                                  item={settings}
                                />
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage Location Status</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.locationStatus.length === 0 ? (
              <EmptyState icon={Boxes} title="No location data yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.locationStatus.map((loc) => (
                    <TableRow key={`${loc.warehouseId}-${loc.locationId ?? "none"}`}>
                      <TableCell>{loc.warehouseName}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.locationLabel ?? "Unspecified"}</TableCell>
                      <TableCell className="text-right tabular-nums">{loc.itemCount}</TableCell>
                      <TableCell>
                        <StatusBadge status={loc.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vegetables Outside Recommended Temperature</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.alerts.length === 0 ? (
              <EmptyState icon={Thermometer} title="Everything is within range" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Recorded</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.alerts.map((l) => (
                    <TableRow key={`${l.itemId}-${l.warehouseId}`}>
                      <TableCell className="font-medium">{l.item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{l.warehouse.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(l.recordedTempC)}°C</TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.item.storageMinTempC != null && l.item.storageMaxTempC != null
                          ? `${Number(l.item.storageMinTempC)}–${Number(l.item.storageMaxTempC)}°C`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batches at Risk</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.batchesAtRisk.length === 0 ? (
              <EmptyState icon={Thermometer} title="No batches currently at risk" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Recorded</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.batchesAtRisk.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.batchNumber}</TableCell>
                      <TableCell>{l.item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{l.warehouse.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(l.recordedTempC)}°C</TableCell>
                      <TableCell>
                        <StatusBadge status={l.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Temperature Log</h2>
        <TemperatureFiltersBar warehouses={warehouses} locations={locations} items={itemOptions} />
        <TemperatureLogTable rows={logTableRows} pagination={paginationMeta(total, pagination)} />
      </div>
    </div>
  );
}
