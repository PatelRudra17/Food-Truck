import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Layers, Thermometer, History } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { LocationManager } from "@/components/warehouses/location-manager";

export const metadata = { title: "Warehouse Detail" };

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("WAREHOUSE_VIEW");
  const { id } = await params;
  const user = await getSessionUser();

  const warehouse = await prisma.warehouse.findUnique({
    where: { id },
    include: {
      manager: true,
      locations: { orderBy: [{ rack: "asc" }, { shelf: "asc" }, { bin: "asc" }] },
    },
  });
  if (!warehouse) notFound();

  const [itemCount, stockAgg, batches, temperatureLogs, movements] = await Promise.all([
    prisma.item.count({ where: { warehouseId: id } }),
    prisma.item.aggregate({ where: { warehouseId: id }, _sum: { currentStock: true } }),
    prisma.procurementBatch.findMany({
      where: { warehouseId: id },
      orderBy: { date: "desc" },
      take: 15,
      include: { item: { select: { name: true } }, supplier: { select: { companyName: true } } },
    }),
    prisma.storageTemperatureLog.findMany({
      where: { warehouseId: id },
      orderBy: { recordedAt: "desc" },
      take: 15,
      include: { item: { select: { name: true } } },
    }),
    prisma.inventoryLedger.findMany({
      where: { warehouseId: id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { item: { select: { name: true, unit: true } }, user: { select: { name: true } } },
    }),
  ]);

  const locations = warehouse.locations.map((l) => ({
    id: l.id,
    rack: l.rack,
    shelf: l.shelf,
    bin: l.bin,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/warehouses" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to warehouses
        </Link>
        <PageHeader
          title={`${warehouse.name} (${warehouse.code})`}
          description={warehouse.address ?? undefined}
          actions={<StatusBadge status={warehouse.status} />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Manager</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium">{warehouse.manager?.name ?? "Unassigned"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Item Count</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium tabular-nums">
            <Link href={`/items?warehouseId=${warehouse.id}`} className="hover:underline">
              {itemCount.toLocaleString()}
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Current Stock</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium tabular-nums">
            {Number(stockAgg._sum.currentStock ?? 0).toLocaleString()}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storage Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationManager
            warehouseId={warehouse.id}
            locations={locations}
            canEdit={hasPermission(user, "WAREHOUSE_EDIT")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Procurement Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <EmptyState icon={Layers} title="No procurement batches at this warehouse yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Raw Weight</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Link href={`/procurement/batches/${b.id}`} className="font-medium hover:underline">
                        {b.batchNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{b.item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.supplier.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">{format(b.date, "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(b.rawWeight).toLocaleString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Thermometer className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Temperature History</CardTitle>
        </CardHeader>
        <CardContent>
          {temperatureLogs.length === 0 ? (
            <EmptyState icon={Thermometer} title="No temperature readings recorded for this warehouse yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recorded At</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Temp (°C)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {temperatureLogs.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{format(t.recordedAt, "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell>{t.item.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(t.recordedTempC)}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Recent Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <EmptyState icon={History} title="No stock movements at this warehouse yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{format(m.createdAt, "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.transactionType} />
                    </TableCell>
                    <TableCell>{m.item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.referenceNumber}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(m.quantity).toLocaleString()} {m.item.unit}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.user.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
