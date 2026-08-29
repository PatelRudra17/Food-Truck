import Link from "next/link";
import {
  Package,
  Boxes,
  PackageCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  XCircle,
  Truck2,
  LogIn,
  LogOut,
  Users2,
  FileClock,
  ClipboardCheck,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getDashboardData } from "@/lib/services/dashboard";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InwardOutwardTrendChart, StockByDimensionChart } from "@/components/dashboard/charts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requirePermission("DASHBOARD_VIEW");
  const data = await getDashboardData();
  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live overview of inventory, stock movement and fleet status.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Total Items" value={kpis.totalItems} icon={Package} href="/items" />
        <KpiCard label="Total Stock" value={kpis.totalStock.toLocaleString()} icon={Boxes} href="/inventory-ledger" />
        <KpiCard
          label="Low Stock"
          value={kpis.lowStock}
          icon={AlertTriangle}
          href="/reports?type=low-stock"
          tone={kpis.lowStock > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Out of Stock"
          value={kpis.outOfStockItems}
          icon={XCircle}
          href="/reports?type=out-of-stock"
          tone={kpis.outOfStockItems > 0 ? "danger" : "default"}
        />
        <KpiCard label="Today's Inward" value={kpis.todaysInward} icon={ArrowDownToLine} href="/stock/inward" />
        <KpiCard label="Today's Outward" value={kpis.todaysOutward} icon={ArrowUpFromLine} href="/stock/outward" />
        <KpiCard label="Total Vehicles" value={kpis.totalVehicles} icon={Truck2} href="/vehicles" />
        <KpiCard label="Vehicles Inside" value={kpis.vehiclesInside} icon={LogIn} href="/gate" />
        <KpiCard label="Vehicles Outside" value={kpis.vehiclesOutside} icon={LogOut} href="/gate" />
        <KpiCard label="Active Drivers" value={kpis.activeDrivers} icon={Users2} href="/drivers" />
        <KpiCard
          label="Expiring Documents"
          value={kpis.expiringDocuments}
          icon={FileClock}
          href="/reports?type=document-expiry"
          tone={kpis.expiringDocuments > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Pending Approvals"
          value={kpis.pendingApprovals}
          icon={ClipboardCheck}
          href="/settings/audit-log"
          tone={kpis.pendingApprovals > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Inward vs Outward (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <InwardOutwardTrendChart data={data.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category-wise Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {data.categoryChart.length > 0 ? (
              <StockByDimensionChart data={data.categoryChart} />
            ) : (
              <EmptyState icon={PackageCheck} title="No stock data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Warehouse-wise Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {data.warehouseChart.length > 0 ? (
              <StockByDimensionChart data={data.warehouseChart} />
            ) : (
              <EmptyState icon={PackageCheck} title="No stock data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Items</CardTitle>
          </CardHeader>
          <CardContent>
            {data.lowStockList.length === 0 ? (
              <EmptyState icon={PackageCheck} title="Nothing below reorder level" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link href={`/items/${item.id}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.warehouseName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(item.currentStock)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(item.reorderLevel)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Inventory Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentLedger.length === 0 ? (
            <EmptyState icon={PackageCheck} title="No transactions yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentLedger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.referenceNumber}</TableCell>
                    <TableCell>{entry.item.name}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.warehouse.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={entry.transactionType} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(entry.quantity)}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.user.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
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
