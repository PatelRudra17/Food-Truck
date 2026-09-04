import Link from "next/link";
import {
  Package,
  Boxes,
  PackageCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  XCircle,
  Truck,
  LogIn,
  LogOut,
  Users2,
  FileClock,
  ClipboardCheck,
  ClipboardList,
  SlidersHorizontal,
  Trash2,
  FileText,
  Send,
  PackageOpen,
  Container,
  AlertOctagon,
  IdCard,
  UserCheck,
  HardHat,
  Scale,
  IndianRupee,
  BadgeCheck,
  Thermometer,
  Fuel,
  Wrench,
  CalendarClock,
  ShieldAlert,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getDashboardData } from "@/lib/services/dashboard";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  InwardOutwardTrendChart,
  StockByDimensionChart,
  SingleSeriesTrendChart,
} from "@/components/dashboard/charts";

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
        <KpiCard label="Total Vehicles" value={kpis.totalVehicles} icon={Truck} href="/vehicles" />
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Today's Procurement" value={kpis.todaysProcurement} icon={ClipboardList} href="/procurement" />
        <KpiCard
          label="Pending Sorting"
          value={kpis.pendingSortingBatches}
          icon={SlidersHorizontal}
          href="/procurement/sorting"
          tone={kpis.pendingSortingBatches > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Today's Wastage"
          value={kpis.todaysWastage.toLocaleString()}
          icon={Trash2}
          href="/wastage"
          tone={kpis.todaysWastage > 0 ? "warning" : "default"}
        />
        <KpiCard label="Pending Sales Orders" value={kpis.pendingSalesOrders} icon={FileText} href="/sales/orders" />
        <KpiCard
          label="Ready for Dispatch"
          value={kpis.readyForDispatchOrders}
          icon={PackageOpen}
          href="/sales/orders?status=READY_FOR_DISPATCH"
        />
        <KpiCard label="Today's Trips" value={kpis.todaysTrips} icon={Send} href="/dispatch" />
        <KpiCard label="Loading" value={kpis.tripsLoading} icon={PackageOpen} href="/dispatch" />
        <KpiCard label="Dispatched" value={kpis.tripsDispatched} icon={Send} href="/dispatch" />
        <KpiCard label="Returned Today" value={kpis.tripsReturnedToday} icon={Truck} href="/dispatch" />
        <KpiCard label="Total Crates" value={kpis.totalCrates} icon={Container} href="/crates" />
        <KpiCard label="Crates Available" value={kpis.availableCrates} icon={Container} href="/crates?status=AVAILABLE" />
        <KpiCard
          label="Crate Issues"
          value={kpis.crateIssues}
          icon={AlertOctagon}
          href="/crates"
          tone={kpis.crateIssues > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Licences Expiring"
          value={kpis.expiringLicences}
          icon={IdCard}
          href="/drivers"
          tone={kpis.expiringLicences > 0 ? "warning" : "default"}
        />
        <KpiCard label="Employees Present" value={kpis.employeesPresentToday} icon={UserCheck} href="/attendance" />
        <KpiCard label="Labour Present" value={kpis.labourPresentToday} icon={HardHat} href="/attendance" />
        <KpiCard label="Current Shift" value={kpis.currentShiftName ?? "None"} icon={ClipboardList} href="/operations/shifts" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Inbound Weight (Today)" value={kpis.inboundWeightToday.toLocaleString()} icon={Scale} href="/procurement" />
        <KpiCard
          label="Purchase Value (Today)"
          value={`₹${kpis.purchaseValueToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={IndianRupee}
          href="/procurement"
        />
        <KpiCard label="Active Vendors" value={kpis.activeVendors} icon={BadgeCheck} href="/suppliers" />
        <KpiCard label="Raw Weight (Today)" value={kpis.rawWeightToday.toLocaleString()} icon={Scale} href="/procurement/sorting" />
        <KpiCard label="Sorted Weight (Today)" value={kpis.sortedWeightToday.toLocaleString()} icon={Scale} href="/procurement/sorting" />
        <KpiCard label="Yield % (Today)" value={`${kpis.yieldPercentToday}%`} icon={PackageCheck} href="/procurement/sorting" />
        <KpiCard label="Grade A (Today)" value={kpis.gradeAToday.toLocaleString()} icon={PackageCheck} href="/procurement/sorting" />
        <KpiCard label="Grade B (Today)" value={kpis.gradeBToday.toLocaleString()} icon={PackageCheck} href="/procurement/sorting" />
        <KpiCard label="Grade C (Today)" value={kpis.gradeCToday.toLocaleString()} icon={PackageCheck} href="/procurement/sorting" />
        <KpiCard
          label="Stock Value"
          value={`₹${kpis.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={IndianRupee}
          href="/inventory-ledger"
        />
        <KpiCard label="Today's Sales Orders" value={kpis.todaysSalesOrders} icon={FileText} href="/sales/orders" />
        <KpiCard label="Approved Sales Orders" value={kpis.approvedSalesOrders} icon={FileText} href="/sales/orders?status=APPROVED" />
        <KpiCard label="Vehicles Available" value={kpis.vehiclesAvailable} icon={Truck} href="/vehicles?status=AVAILABLE" />
        <KpiCard label="Vehicles On Trip" value={kpis.vehiclesOnTrip} icon={Truck} href="/vehicles?status=ON_TRIP" />
        <KpiCard
          label="Under Maintenance"
          value={kpis.vehiclesUnderMaintenance}
          icon={Wrench}
          href="/maintenance"
          tone={kpis.vehiclesUnderMaintenance > 0 ? "warning" : "default"}
        />
        <KpiCard label="Available Drivers" value={kpis.availableDrivers} icon={Users2} href="/drivers" />
        <KpiCard label="Crates With Customer" value={kpis.cratesWithCustomer} icon={Container} href="/crates?status=WITH_CUSTOMER" />
        <KpiCard label="Crates Returned" value={kpis.cratesReturned} icon={Container} href="/crates?status=RETURNED" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard
          label="Expired Documents"
          value={kpis.expiredDocuments}
          icon={ShieldAlert}
          href="/documents"
          tone={kpis.expiredDocuments > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Temperature Alerts"
          value={kpis.temperatureAlertsToday}
          icon={Thermometer}
          href="/storage-temperature"
          tone={kpis.temperatureAlertsToday > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Fuel Anomalies"
          value={kpis.fuelAnomalies}
          icon={Fuel}
          href="/fuel"
          tone={kpis.fuelAnomalies > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Maintenance Due"
          value={kpis.maintenanceDue}
          icon={CalendarClock}
          href="/maintenance"
          tone={kpis.maintenanceDue > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Overdue Crate Returns"
          value={kpis.overdueCrateReturns}
          icon={AlertOctagon}
          href="/crates/returns"
          tone={kpis.overdueCrateReturns > 0 ? "danger" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Inward vs Outward (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.trend.some(t => t.inward > 0 || t.outward > 0) ? (
              <InwardOutwardTrendChart data={data.trend} />
            ) : (
              <EmptyState icon={PackageCheck} title="No transaction data yet" />
            )}
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

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Procurement Trend (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.procurementTrend.some((t) => t.value > 0) ? (
              <SingleSeriesTrendChart data={data.procurementTrend} label="Raw Weight" color="#2a78d6" />
            ) : (
              <EmptyState icon={Scale} title="No procurement data yet" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Trend (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.salesTrend.some((t) => t.value > 0) ? (
              <SingleSeriesTrendChart data={data.salesTrend} label="Order Value" color="#16a34a" />
            ) : (
              <EmptyState icon={FileText} title="No sales data yet" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wastage Trend (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.wastageTrend.some((t) => t.value > 0) ? (
              <SingleSeriesTrendChart data={data.wastageTrend} label="Wastage" color="#dc2626" />
            ) : (
              <EmptyState icon={Trash2} title="No wastage data yet" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dispatch Trend (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dispatchTrend.some((t) => t.value > 0) ? (
              <SingleSeriesTrendChart data={data.dispatchTrend} label="Trips" color="#7c3aed" />
            ) : (
              <EmptyState icon={Send} title="No dispatch data yet" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution (Today)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.gradeDistributionChart.length > 0 ? (
              <StockByDimensionChart data={data.gradeDistributionChart} />
            ) : (
              <EmptyState icon={PackageCheck} title="No sorting data yet" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fuel Expense (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.fuelExpenseChart.some((t) => t.value > 0) ? (
              <StockByDimensionChart data={data.fuelExpenseChart} />
            ) : (
              <EmptyState icon={Fuel} title="No fuel expense yet" />
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Maintenance Expense (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.maintenanceExpenseChart.some((t) => t.value > 0) ? (
              <StockByDimensionChart data={data.maintenanceExpenseChart} />
            ) : (
              <EmptyState icon={Wrench} title="No maintenance expense yet" />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            {data.pendingApprovals.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="No pending approvals." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Requested By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pendingApprovals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.moduleLabel}</TableCell>
                      <TableCell>
                        <Link href={a.href} className="font-medium hover:underline">
                          {a.label}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.summary}</TableCell>
                      <TableCell className="text-muted-foreground">{a.requestedByName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiring Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {data.expiringDocuments.length === 0 ? (
              <EmptyState icon={FileClock} title="No documents expiring soon." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expiringDocuments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.subject}</TableCell>
                      <TableCell className="text-muted-foreground">{d.kind}</TableCell>
                      <TableCell className="text-muted-foreground">{d.docType}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : "—"}
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
            <CardTitle className="text-base">Temperature Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {data.temperatureAlerts.length === 0 ? (
              <EmptyState icon={Thermometer} title="No temperature alerts." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">Temp (°C)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.temperatureAlerts.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.item}</TableCell>
                      <TableCell className="text-muted-foreground">{t.warehouse}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.recordedTempC}</TableCell>
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
          <CardHeader>
            <CardTitle className="text-base">Fuel Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            {data.fuelAnomalyRows.length === 0 ? (
              <EmptyState icon={Fuel} title="No fuel anomalies detected." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Mileage</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.fuelAnomalyRows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.vehicle}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(f.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.mileageKmpl ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.anomalyNote ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
