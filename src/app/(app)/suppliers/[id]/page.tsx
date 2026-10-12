import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Building2, Package, FileText, ArrowDownToLine, Truck, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { SupplierAttachments } from "@/components/suppliers/supplier-attachments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil } from "lucide-react";

export const metadata = { title: "Supplier Details" };

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("SUPPLIER_VIEW");
  const user = await getSessionUser();
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) notFound();

  const [purchaseOrders, items, inwards, attachments, procurements, wastages, procurementAgg, receivedInwardItems] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { supplierId: id },
      orderBy: { date: "desc" },
      take: 50,
      select: { id: true, poNumber: true, date: true, status: true, totalAmount: true },
    }),
    prisma.item.findMany({
      where: { supplierId: id },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, sku: true, itemCode: true, name: true, unit: true, currentStock: true, isActive: true },
    }),
    prisma.stockInward.findMany({
      where: { supplierId: id },
      orderBy: { date: "desc" },
      take: 50,
      select: { id: true, inwardNumber: true, date: true, status: true, warehouse: { select: { name: true } } },
    }),
    prisma.attachment.findMany({
      where: { supplierFk: id, isDeleted: false },
      orderBy: { uploadedAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    }),
    prisma.procurement.findMany({
      where: { supplierId: id },
      orderBy: { date: "desc" },
      take: 50,
      include: {
        items: { select: { item: { select: { name: true } }, quantity: true, unit: true, quality: true, total: true } },
      },
    }),
    prisma.wastage.findMany({
      where: { batch: { supplierId: id } },
      orderBy: { date: "desc" },
      take: 50,
      select: {
        id: true,
        wastageNumber: true,
        date: true,
        quantity: true,
        reason: true,
        item: { select: { name: true, unit: true } },
        batch: { select: { batchNumber: true } },
      },
    }),
    prisma.procurementItem.aggregate({
      where: { procurement: { supplierId: id } },
      _sum: { quantity: true, total: true },
    }),
    // Goods received through Stock Inward (with or without a PO) count as supplied too.
    prisma.stockInwardItem.findMany({
      where: { inward: { supplierId: id, status: "RECEIVED" } },
      select: { quantity: true, total: true, poItem: { select: { rate: true, taxPercent: true } } },
    }),
  ]);

  // An inward line's own total wins; otherwise value it at the linked PO line's rate (+ tax).
  const inwardTotals = receivedInwardItems.reduce(
    (acc, line) => {
      const qty = Number(line.quantity);
      let value = 0;
      if (line.total != null) value = Number(line.total);
      else if (line.poItem) value = qty * Number(line.poItem.rate) * (1 + Number(line.poItem.taxPercent ?? 0) / 100);
      return { quantity: acc.quantity + qty, value: acc.value + value };
    },
    { quantity: 0, value: 0 },
  );
  const totalQuantitySupplied = Number(procurementAgg._sum.quantity ?? 0) + inwardTotals.quantity;
  const totalPurchaseValue = Number(procurementAgg._sum.total ?? 0) + inwardTotals.value;

  const canEdit = hasPermission(user, "SUPPLIER_EDIT");

  return (
    <div className="space-y-6">
      <PageHeader
        title={supplier.companyName}
        description={`Supplier code: ${supplier.code}`}
        actions={
          canEdit ? (
            <SupplierFormDialog
              supplier={{
                id: supplier.id,
                code: supplier.code,
                companyName: supplier.companyName,
                contactPerson: supplier.contactPerson ?? "",
                phone: supplier.phone ?? "",
                email: supplier.email ?? "",
                address: supplier.address ?? "",
                gstNumber: supplier.gstNumber ?? "",
                panNumber: supplier.panNumber ?? "",
                status: supplier.status,
              }}
              trigger={
                <Button size="sm" variant="outline">
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Quantity Supplied</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium tabular-nums">
            {totalQuantitySupplied.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Purchase Value</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium tabular-nums">
            ₹{totalPurchaseValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Wastage Records</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium tabular-nums">{wastages.length.toLocaleString()}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Supplier Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={supplier.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact Person</dt>
              <dd className="mt-0.5">{supplier.contactPerson ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="mt-0.5">{supplier.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5">{supplier.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">GST Number</dt>
              <dd className="mt-0.5">{supplier.gstNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PAN Number</dt>
              <dd className="mt-0.5">{supplier.panNumber ?? "—"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="mt-0.5">{supplier.address ?? "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <EmptyState icon={FileText} title="No purchase orders yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell>
                      <Link href={`/purchase-orders/${po.id}`} className="font-medium hover:underline">
                        {po.poNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{format(po.date, "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={po.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(po.totalAmount).toLocaleString()}
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
          <Truck className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Procurement History</CardTitle>
        </CardHeader>
        <CardContent>
          {procurements.length === 0 ? (
            <EmptyState icon={Truck} title="No procurement records yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procurement #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items / Quality</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procurements.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/procurement/${p.id}`} className="font-medium hover:underline">
                        {p.procurementNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{format(p.date, "dd MMM yyyy")}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.items
                        .map((it) => `${it.item.name} (${Number(it.quantity).toLocaleString()} ${it.unit}${it.quality ? `, ${it.quality}` : ""})`)
                        .join("; ") || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ₹{p.items.reduce((sum, it) => sum + Number(it.total ?? 0), 0).toLocaleString()}
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
          <Trash2 className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Wastage History</CardTitle>
        </CardHeader>
        <CardContent>
          {wastages.length === 0 ? (
            <EmptyState icon={Trash2} title="No wastage linked to this supplier's batches" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Wastage #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wastages.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.wastageNumber}</TableCell>
                    <TableCell>{format(w.date, "dd MMM yyyy")}</TableCell>
                    <TableCell>{w.item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{w.batch?.batchNumber ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{w.reason.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(w.quantity).toLocaleString()} {w.item.unit}
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
          <Package className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Items Supplied</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={Package} title="No items linked to this supplier" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.itemCode}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(item.currentStock).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
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
          <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Inward History</CardTitle>
        </CardHeader>
        <CardContent>
          {inwards.length === 0 ? (
            <EmptyState icon={ArrowDownToLine} title="No stock inward records yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inward Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inwards.map((inward) => (
                  <TableRow key={inward.id}>
                    <TableCell className="font-medium">{inward.inwardNumber}</TableCell>
                    <TableCell>{format(inward.date, "dd MMM yyyy")}</TableCell>
                    <TableCell>{inward.warehouse.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={inward.status} />
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
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierAttachments
            supplierId={supplier.id}
            canUpload={canEdit}
            attachments={attachments.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              documentType: a.documentType,
              sizeBytes: a.sizeBytes,
              uploadedAt: format(a.uploadedAt, "dd MMM yyyy"),
              uploadedByName: a.uploadedBy.name,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
