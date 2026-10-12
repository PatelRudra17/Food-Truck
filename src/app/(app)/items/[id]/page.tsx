import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Archive, RotateCcw, ScrollText, Truck, Scissors, Trash2, ShoppingCart, Thermometer } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemCodes } from "@/components/items/item-codes";
import { archiveItemAction, restoreItemAction } from "@/lib/actions/item-actions";

export const metadata = { title: "Item Detail" };

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ITEM_VIEW");
  const { id } = await params;
  const user = await getSessionUser();

  const item = await prisma.item.findUnique({
    where: { id },
    include: { category: true, warehouse: true, location: true, supplier: true },
  });
  if (!item) notFound();

  const [warehouseStocks, ledger, gradeStocks, procurementItems, sortings, wastages, salesOrderItems, temperatureLogs] =
    await Promise.all([
      prisma.itemWarehouseStock.findMany({
        where: { itemId: id, quantity: { not: 0 } },
        include: { warehouse: { select: { id: true, name: true, code: true } } },
        orderBy: { warehouse: { name: "asc" } },
      }),
      prisma.inventoryLedger.findMany({
        where: { itemId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { warehouse: true, user: true },
      }),
      prisma.itemGradeStock.findMany({
        where: { itemId: id },
        include: { warehouse: { select: { name: true } } },
        orderBy: [{ warehouse: { name: "asc" } }, { grade: "asc" }],
      }),
      prisma.procurementItem.findMany({
        where: { itemId: id },
        include: {
          procurement: { select: { procurementNumber: true, date: true, supplier: { select: { companyName: true } } } },
        },
        orderBy: { procurement: { date: "desc" } },
        take: 20,
      }),
      prisma.sorting.findMany({
        where: { batch: { itemId: id } },
        include: { batch: { select: { batchNumber: true } } },
        orderBy: { sortedAt: "desc" },
        take: 20,
      }),
      prisma.wastage.findMany({
        where: { itemId: id },
        include: { batch: { select: { batchNumber: true } }, warehouse: { select: { name: true } } },
        orderBy: { date: "desc" },
        take: 20,
      }),
      prisma.salesOrderItem.findMany({
        where: { itemId: id },
        include: { salesOrder: { select: { soNumber: true, orderDate: true, customer: { select: { name: true } } } } },
        orderBy: { salesOrder: { orderDate: "desc" } },
        take: 20,
      }),
      prisma.storageTemperatureLog.findMany({
        where: { itemId: id },
        orderBy: { recordedAt: "desc" },
        take: 20,
      }),
    ]);

  const isLow = Number(item.currentStock) <= Number(item.reorderLevel);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/items" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to items
        </Link>
        <PageHeader
          title={item.name}
          description={`${item.sku} • ${item.itemCode}`}
          actions={
            <>
              <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
              {hasPermission(user, "ITEM_EDIT") && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/items/${id}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
              )}
              {hasPermission(user, "ITEM_ARCHIVE") &&
                (item.isActive ? (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        <Archive /> Archive
                      </Button>
                    }
                    title="Archive item?"
                    description={`"${item.name}" will be marked inactive. It will not be deleted and its history is preserved.`}
                    confirmLabel="Archive"
                    destructive
                    onConfirm={archiveItemAction.bind(null, id)}
                  />
                ) : (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm">
                        <RotateCcw /> Restore
                      </Button>
                    }
                    title="Restore item?"
                    description={`"${item.name}" will become active again.`}
                    confirmLabel="Restore"
                    onConfirm={restoreItemAction.bind(null, id)}
                  />
                ))}
            </>
          }
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="procurement">Procurement</TabsTrigger>
          <TabsTrigger value="sorting">Sorting</TabsTrigger>
          <TabsTrigger value="wastage">Wastage</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="temperature">Temperature</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold tabular-nums ${isLow ? "text-red-700 dark:text-red-400" : ""}`}>
              {Number(item.currentStock).toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
            </p>
            {isLow && <p className="text-xs text-red-700 dark:text-red-400">At or below reorder level</p>}
            <Link
              href={`/inventory-ledger?itemId=${item.id}`}
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ScrollText className="h-3 w-3" /> View full ledger
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Reorder Level</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{Number(item.reorderLevel).toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Opening Stock (at creation)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{Number(item.openingStock).toLocaleString()}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailField label="Category" value={item.category.name} />
          <DetailField label="Brand" value={item.brand} />
          <DetailField label="Unit" value={item.unit} />
          <DetailField label="Min Stock" value={Number(item.minStock).toLocaleString()} />
          <DetailField label="Max Stock" value={item.maxStock !== null ? Number(item.maxStock).toLocaleString() : null} />
          <DetailField label="Warehouse" value={item.warehouse?.name} />
          <DetailField
            label="Location"
            value={
              item.location
                ? [item.location.rack && `Rack ${item.location.rack}`, item.location.shelf && `Shelf ${item.location.shelf}`, item.location.bin && `Bin ${item.location.bin}`]
                    .filter(Boolean)
                    .join(" / ")
                : null
            }
          />
          <DetailField label="Supplier" value={item.supplier?.companyName} />
          <DetailField label="Purchase Price" value={item.purchasePrice !== null ? Number(item.purchasePrice).toLocaleString() : null} />
          <DetailField label="Tax %" value={item.taxPercent !== null ? `${Number(item.taxPercent)}%` : null} />
          <DetailField label="HSN Code" value={item.hsnCode} />
          <DetailField label="Batch Tracked" value={item.batchTracked ? "Yes" : "No"} />
          <DetailField label="Serial Tracked" value={item.serialTracked ? "Yes" : "No"} />
          <DetailField label="Expiry Tracked" value={item.expiryTracked ? "Yes" : "No"} />
          <DetailField label="Shelf Life (days)" value={item.shelfLifeDays} />
          <DetailField label="Temperature Sensitive" value={item.isTemperatureSensitive ? "Yes" : "No"} />
          <DetailField
            label="Storage Temp Range"
            value={
              item.storageMinTempC !== null || item.storageMaxTempC !== null
                ? `${item.storageMinTempC !== null ? Number(item.storageMinTempC) : "?"}°C to ${item.storageMaxTempC !== null ? Number(item.storageMaxTempC) : "?"}°C`
                : null
            }
          />
          <DetailField label="Storage Type" value={item.storageType?.replaceAll("_", " ")} />
          <DetailField label="Storage Location (text)" value={item.storageLocationText} />
          {item.description && <DetailField label="Description" value={item.description} />}
        </CardContent>
      </Card>

      {item.imageUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Image</CardTitle>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.imageUrl} alt={item.name} className="max-h-64 rounded-md border object-contain" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">QR Code &amp; Barcode</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemCodes
            itemId={item.id}
            qrCodePayload={item.qrCodePayload}
            barcode={item.barcode}
            canEdit={hasPermission(user, "ITEM_EDIT")}
          />
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="inventory" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stock by Warehouse</CardTitle>
            </CardHeader>
            <CardContent>
              {warehouseStocks.length === 0 ? (
                <EmptyState icon={ScrollText} title="This item has no stock in any warehouse." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouseStocks.map((s) => (
                      <TableRow key={s.warehouseId}>
                        <TableCell>
                          <Link href={`/warehouses/${s.warehouse.id}`} className="hover:underline">
                            {s.warehouse.name} ({s.warehouse.code})
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(s.quantity).toLocaleString()} {item.unit}
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
              <CardTitle className="text-base">Grade-wise Stock (sorted produce)</CardTitle>
            </CardHeader>
            <CardContent>
              {gradeStocks.length === 0 ? (
                <EmptyState icon={ScrollText} title="No grade-wise stock recorded for this item yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gradeStocks.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>{g.warehouse.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={g.grade} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(g.quantity).toLocaleString()} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Batch-wise stock is not shown separately — current balances are tracked per warehouse and grade, not
                per batch (batches are traceable via Procurement/Sorting history, not as a running stock balance).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procurement" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor &amp; Purchase History</CardTitle>
            </CardHeader>
            <CardContent>
              {procurementItems.length === 0 ? (
                <EmptyState icon={Truck} title="No procurement history for this item yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Procurement #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procurementItems.map((pi) => (
                      <TableRow key={pi.id}>
                        <TableCell className="font-medium">{pi.procurement.procurementNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{format(pi.procurement.date, "dd MMM yyyy")}</TableCell>
                        <TableCell>{pi.procurement.supplier.companyName}</TableCell>
                        <TableCell className="text-muted-foreground">{pi.quality ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(pi.quantity).toLocaleString()} {pi.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {pi.purchasePrice !== null ? `₹${Number(pi.purchasePrice).toLocaleString()}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sorting" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sorting / Grading History</CardTitle>
            </CardHeader>
            <CardContent>
              {sortings.length === 0 ? (
                <EmptyState icon={Scissors} title="No sorting records for this item yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Raw</TableHead>
                      <TableHead className="text-right">Grade A</TableHead>
                      <TableHead className="text-right">Grade B</TableHead>
                      <TableHead className="text-right">Grade C</TableHead>
                      <TableHead className="text-right">Waste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortings.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.batch.batchNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{format(s.sortedAt, "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(s.rawWeight).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(s.gradeAWeight).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(s.gradeBWeight).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(s.gradeCWeight).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(s.wasteWeight).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wastage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wastage History</CardTitle>
            </CardHeader>
            <CardContent>
              {wastages.length === 0 ? (
                <EmptyState icon={Trash2} title="No wastage recorded for this item yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wastage #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Warehouse / Batch</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wastages.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.wastageNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{format(w.date, "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {w.warehouse?.name ?? w.batch?.batchNumber ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{w.reason.replaceAll("_", " ")}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(w.quantity).toLocaleString()} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales History</CardTitle>
            </CardHeader>
            <CardContent>
              {salesOrderItems.length === 0 ? (
                <EmptyState icon={ShoppingCart} title="No sales history for this item yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sales Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesOrderItems.map((soi) => (
                      <TableRow key={soi.id}>
                        <TableCell>
                          <Link href={`/sales/orders/${soi.salesOrderId}`} className="font-medium hover:underline">
                            {soi.salesOrder.soNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{format(soi.salesOrder.orderDate, "dd MMM yyyy")}</TableCell>
                        <TableCell>{soi.salesOrder.customer.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={soi.grade} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(soi.quantity).toLocaleString()} {item.unit}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">₹{Number(soi.total).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="temperature" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Temperature History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <DetailField
                  label="Required Range"
                  value={
                    item.storageMinTempC !== null || item.storageMaxTempC !== null
                      ? `${item.storageMinTempC !== null ? Number(item.storageMinTempC) : "?"}°C to ${item.storageMaxTempC !== null ? Number(item.storageMaxTempC) : "?"}°C`
                      : null
                  }
                />
                <DetailField label="Temperature Sensitive" value={item.isTemperatureSensitive ? "Yes" : "No"} />
              </div>
              {temperatureLogs.length === 0 ? (
                <EmptyState icon={Thermometer} title="No temperature readings recorded for this item yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recorded At</TableHead>
                      <TableHead className="text-right">Temp (°C)</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {temperatureLogs.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-muted-foreground">{format(t.recordedAt, "dd MMM yyyy, HH:mm")}</TableCell>
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
        </TabsContent>

        <TabsContent value="history" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Stock Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <EmptyState icon={ScrollText} title="No stock movements yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <StatusBadge status={entry.transactionType} />
                    </TableCell>
                    <TableCell>{entry.referenceNumber}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.warehouse.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(entry.quantity).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(entry.beforeQty).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(entry.afterQty).toLocaleString()}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.user.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
