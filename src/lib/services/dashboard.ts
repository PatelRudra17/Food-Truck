import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getOverdueDays } from "@/lib/services/crate-alerts";
import { getPendingApprovals } from "@/lib/services/approvals";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData() {
  const today = startOfToday();
  const in30 = new Date(Date.now() + 30 * 86400000);
  const last30 = new Date(Date.now() - 30 * 86400000);
  const overdueDays = await getOverdueDays();
  const overdueThreshold = new Date(Date.now() - overdueDays * 86400000);

  const [
    totalItems,
    outOfStockItems,
    todaysInward,
    todaysOutward,
    totalVehicles,
    vehiclesInside,
    vehiclesOutside,
    vehiclesAvailable,
    vehiclesOnTrip,
    vehiclesUnderMaintenance,
    activeDrivers,
    availableDrivers,
    pendingApprovalsCount,
    expiringVehicleDocs,
    expiringDriverDocs,
    expiredVehicleDocs,
    expiredDriverDocs,
    recentLedger,
    lowStockList,
    stockAgg,
    stockValueAgg,
    todaysProcurement,
    inboundWeightAgg,
    purchaseValueAgg,
    activeVendors,
    pendingSortingBatches,
    sortingAgg,
    todaysWastage,
    pendingSalesOrders,
    approvedSalesOrders,
    todaysSalesOrders,
    readyForDispatchOrders,
    todaysTrips,
    tripsLoading,
    tripsDispatched,
    tripsReturnedToday,
    totalCrates,
    availableCrates,
    cratesWithCustomer,
    cratesReturned,
    cratesDamaged,
    cratesMissing,
    overdueCrateReturns,
    expiringLicences,
    currentShift,
    temperatureAlertsToday,
    fuelAnomalies,
    maintenanceDue,
    temperatureAlertRows,
    fuelAnomalyRows,
  ] = await Promise.all([
    prisma.item.count({ where: { isActive: true } }),
    prisma.item.count({ where: { isActive: true, currentStock: { lte: 0 } } }),
    prisma.stockInward.count({ where: { date: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.stockOutward.count({ where: { date: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: "INSIDE" } }),
    prisma.vehicle.count({ where: { status: { in: ["OUTSIDE", "ON_TRIP"] } } }),
    prisma.vehicle.count({ where: { status: "AVAILABLE" } }),
    prisma.vehicle.count({ where: { status: "ON_TRIP" } }),
    prisma.vehicle.count({ where: { status: "MAINTENANCE" } }),
    prisma.driver.count({ where: { status: "ACTIVE" } }),
    prisma.driver.count({
      where: { status: "ACTIVE", trips: { none: { status: { in: ["LOADING", "LOADED", "DISPATCHED"] } } } },
    }),
    prisma.approval.count({ where: { decision: "PENDING" } }),
    prisma.vehicleDocument.count({ where: { expiryDate: { gte: today, lte: in30 } } }),
    prisma.driverDocument.count({ where: { expiryDate: { gte: today, lte: in30 } } }),
    prisma.vehicleDocument.count({ where: { expiryDate: { lt: today } } }),
    prisma.driverDocument.count({ where: { expiryDate: { lt: today } } }),
    prisma.inventoryLedger.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { item: true, warehouse: true, user: true },
    }),
    // Raw comparison of two columns on the same row — Prisma's query API can't
    // express column-to-column filters, so this runs directly in Postgres and
    // stays correct (and indexed) regardless of catalog size.
    prisma.$queryRaw<
      { id: string; name: string; sku: string; currentStock: Prisma.Decimal; reorderLevel: Prisma.Decimal; warehouseName: string | null }[]
    >`
      SELECT i.id, i.name, i.sku, i."currentStock", i."reorderLevel", w.name AS "warehouseName"
      FROM "Item" i
      LEFT JOIN "Warehouse" w ON w.id = i."warehouseId"
      WHERE i."isActive" = true AND i."currentStock" <= i."reorderLevel"
      ORDER BY (i."currentStock" - i."reorderLevel") ASC
      LIMIT 8
    `,
    prisma.item.aggregate({ _sum: { currentStock: true } }),
    // Same column-to-column limitation as above, plus a product of two columns.
    prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
      SELECT SUM(i."currentStock" * COALESCE(i."purchasePrice", 0)) AS value
      FROM "Item" i
      WHERE i."isActive" = true
    `,
    prisma.procurement.count({ where: { date: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.procurementBatch.aggregate({ where: { date: { gte: today } }, _sum: { rawWeight: true } }),
    prisma.procurementItem.aggregate({ where: { procurement: { date: { gte: today } } }, _sum: { total: true } }),
    prisma.supplier.count({ where: { status: "ACTIVE" } }),
    prisma.procurementBatch.count({ where: { status: "PENDING_SORTING" } }),
    prisma.sorting.aggregate({
      where: { sortedAt: { gte: today } },
      _sum: { rawWeight: true, gradeAWeight: true, gradeBWeight: true, gradeCWeight: true, otherGradeWeight: true, wasteWeight: true },
    }),
    prisma.wastage.aggregate({ where: { date: { gte: today } }, _sum: { quantity: true } }),
    prisma.salesOrder.count({ where: { status: "PENDING" } }),
    prisma.salesOrder.count({ where: { status: "APPROVED" } }),
    prisma.salesOrder.count({ where: { orderDate: { gte: today } } }),
    prisma.salesOrder.count({ where: { status: "READY_FOR_DISPATCH" } }),
    prisma.trip.count({ where: { createdAt: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.trip.count({ where: { status: { in: ["LOADING", "LOADED"] } } }),
    prisma.trip.count({ where: { status: "DISPATCHED" } }),
    prisma.trip.count({ where: { returnedAt: { gte: today }, status: "RETURNED" } }),
    prisma.crate.count(),
    prisma.crate.count({ where: { status: "AVAILABLE" } }),
    prisma.crate.count({ where: { status: "WITH_CUSTOMER" } }),
    prisma.crate.count({ where: { status: "RETURNED" } }),
    prisma.crate.count({ where: { status: "DAMAGED" } }),
    prisma.crate.count({ where: { status: "MISSING" } }),
    prisma.crate.count({ where: { status: "WITH_CUSTOMER", updatedAt: { lte: overdueThreshold } } }),
    prisma.driverDocument.count({
      where: { docType: "DRIVING_LICENCE", expiryDate: { gte: today, lte: in30 } },
    }),
    prisma.shift.findFirst({ where: { status: "ACTIVE" }, orderBy: { startTime: "desc" }, select: { shiftName: true } }),
    prisma.storageTemperatureLog.count({ where: { status: { in: ["WARNING", "CRITICAL"] }, recordedAt: { gte: today } } }),
    prisma.fuelEntry.count({ where: { isAnomaly: true, isVoided: false, date: { gte: last30 } } }),
    prisma.vehicle.count({ where: { maintenanceState: { in: ["DUE", "OVERDUE"] } } }),
    prisma.storageTemperatureLog.findMany({
      where: { status: { in: ["WARNING", "CRITICAL"] } },
      orderBy: { recordedAt: "desc" },
      take: 6,
      include: { item: true, warehouse: true },
    }),
    prisma.fuelEntry.findMany({
      where: { isAnomaly: true, isVoided: false },
      orderBy: { date: "desc" },
      take: 6,
      include: { vehicle: true },
    }),
  ]);

  const lowStockCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "Item" WHERE "isActive" = true AND "currentStock" <= "reorderLevel"
  `;
  const lowStock = lowStockList;

  const [inwardTrend, outwardTrend, procurementTrendRaw, salesTrendRaw, wastageTrendRaw, dispatchTrendRaw] = await Promise.all([
    prisma.inventoryLedger.groupBy({
      by: ["createdAt"],
      where: { transactionType: "INWARD", createdAt: { gte: last30 } },
      _sum: { quantity: true },
    }),
    prisma.inventoryLedger.groupBy({
      by: ["createdAt"],
      where: { transactionType: "OUTWARD", createdAt: { gte: last30 } },
      _sum: { quantity: true },
    }),
    prisma.procurementBatch.findMany({ where: { date: { gte: last30 } }, select: { date: true, rawWeight: true } }),
    prisma.salesOrder.findMany({ where: { orderDate: { gte: last30 } }, select: { orderDate: true, totalAmount: true } }),
    prisma.wastage.findMany({ where: { date: { gte: last30 } }, select: { date: true, quantity: true } }),
    prisma.trip.findMany({ where: { createdAt: { gte: last30 } }, select: { createdAt: true } }),
  ]);

  function bucketByDay(rows: { createdAt: Date; _sum: { quantity: Prisma.Decimal | null } }[]) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(row._sum.quantity ?? 0));
    }
    return map;
  }

  function bucketSumByDay<T>(rows: T[], dateOf: (r: T) => Date, valueOf: (r: T) => number) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = dateOf(row).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + valueOf(row));
    }
    return map;
  }

  const inwardMap = bucketByDay(inwardTrend);
  const outwardMap = bucketByDay(outwardTrend);
  const days: { date: string; inward: number; outward: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key.slice(5),
      inward: inwardMap.get(key) ?? 0,
      outward: outwardMap.get(key) ?? 0,
    });
  }

  const procurementMap = bucketSumByDay(procurementTrendRaw, (r) => r.date, (r) => Number(r.rawWeight));
  const salesMap = bucketSumByDay(salesTrendRaw, (r) => r.orderDate, (r) => Number(r.totalAmount));
  const wastageMap = bucketSumByDay(wastageTrendRaw, (r) => r.date, (r) => Number(r.quantity));
  const dispatchMap = bucketSumByDay(dispatchTrendRaw, (r) => r.createdAt, () => 1);

  const procurementTrend: { date: string; value: number }[] = [];
  const salesTrend: { date: string; value: number }[] = [];
  const wastageTrend: { date: string; value: number }[] = [];
  const dispatchTrend: { date: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label = key.slice(5);
    procurementTrend.push({ date: label, value: procurementMap.get(key) ?? 0 });
    salesTrend.push({ date: label, value: salesMap.get(key) ?? 0 });
    wastageTrend.push({ date: label, value: wastageMap.get(key) ?? 0 });
    dispatchTrend.push({ date: label, value: dispatchMap.get(key) ?? 0 });
  }

  const categoryStock = await prisma.item.groupBy({
    by: ["categoryId"],
    where: { isActive: true },
    _sum: { currentStock: true },
  });
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryStock.map((c) => c.categoryId) } },
  });
  const categoryChart = categoryStock.map((c) => ({
    name: categories.find((cat) => cat.id === c.categoryId)?.name ?? "Unknown",
    value: Number(c._sum.currentStock ?? 0),
  }));

  const warehouseStock = await prisma.item.groupBy({
    by: ["warehouseId"],
    where: { isActive: true, warehouseId: { not: null } },
    _sum: { currentStock: true },
  });
  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: warehouseStock.map((w) => w.warehouseId!).filter(Boolean) } },
  });
  const warehouseChart = warehouseStock.map((w) => ({
    name: warehouses.find((wh) => wh.id === w.warehouseId)?.name ?? "Unknown",
    value: Number(w._sum.currentStock ?? 0),
  }));

  const gradeDistributionChart = [
    { name: "Grade A", value: Number(sortingAgg._sum.gradeAWeight ?? 0) },
    { name: "Grade B", value: Number(sortingAgg._sum.gradeBWeight ?? 0) },
    { name: "Grade C", value: Number(sortingAgg._sum.gradeCWeight ?? 0) },
    { name: "Other", value: Number(sortingAgg._sum.otherGradeWeight ?? 0) },
    { name: "Waste", value: Number(sortingAgg._sum.wasteWeight ?? 0) },
  ].filter((g) => g.value > 0);

  // Fuel/maintenance expense by month, last 6 months — matches the cost-summary
  // pattern already used on the Maintenance page (monthStart/yearStart aggregates).
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [fuelCostRows, maintenanceCostRows] = await Promise.all([
    prisma.fuelEntry.findMany({
      where: { isVoided: false, date: { gte: sixMonthsAgo } },
      select: { date: true, totalFuelCost: true },
    }),
    prisma.vehicleMaintenance.findMany({
      where: { isArchived: false, serviceDate: { gte: sixMonthsAgo } },
      select: { serviceDate: true, totalCost: true },
    }),
  ]);

  function bucketByMonth<T>(rows: T[], dateOf: (r: T) => Date, valueOf: (r: T) => number) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const d = dateOf(row);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + valueOf(row));
    }
    return map;
  }

  const fuelCostMap = bucketByMonth(fuelCostRows, (r) => r.date, (r) => Number(r.totalFuelCost));
  const maintenanceCostMap = bucketByMonth(maintenanceCostRows, (r) => r.serviceDate, (r) => Number(r.totalCost));
  const fuelExpenseChart: { name: string; value: number }[] = [];
  const maintenanceExpenseChart: { name: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    fuelExpenseChart.push({ name: label, value: fuelCostMap.get(key) ?? 0 });
    maintenanceExpenseChart.push({ name: label, value: maintenanceCostMap.get(key) ?? 0 });
  }

  const pendingApprovals = (await getPendingApprovals()).slice(0, 6);

  const expiringDocuments = [
    ...(await prisma.vehicleDocument.findMany({
      where: { expiryDate: { lte: in30 } },
      include: { vehicle: true },
      orderBy: { expiryDate: "asc" },
      take: 6,
    })).map((d) => ({
      id: d.id,
      subject: d.vehicle.vehicleNumber,
      docType: d.docType as string,
      expiryDate: d.expiryDate,
      kind: "Vehicle" as const,
    })),
    ...(await prisma.driverDocument.findMany({
      where: { expiryDate: { lte: in30 } },
      include: { driver: true },
      orderBy: { expiryDate: "asc" },
      take: 6,
    })).map((d) => ({
      id: d.id,
      subject: d.driver.fullName,
      docType: d.docType as string,
      expiryDate: d.expiryDate,
      kind: "Driver" as const,
    })),
  ]
    .filter((d) => d.expiryDate)
    .sort((a, b) => a.expiryDate!.getTime() - b.expiryDate!.getTime())
    .slice(0, 8);

  const temperatureAlerts = temperatureAlertRows.map((t) => ({
    id: t.id,
    item: t.item.name,
    warehouse: t.warehouse.name,
    recordedTempC: Number(t.recordedTempC),
    status: t.status,
    recordedAt: t.recordedAt,
  }));

  const fuelAnomalyRowsFormatted = fuelAnomalyRows.map((f) => ({
    id: f.id,
    vehicle: f.vehicle.vehicleNumber,
    date: f.date,
    mileageKmpl: f.mileageKmpl ? Number(f.mileageKmpl) : null,
    fuelCostPerKm: f.fuelCostPerKm ? Number(f.fuelCostPerKm) : null,
    anomalyNote: f.anomalyNote,
  }));

  const rawWeightToday = Number(sortingAgg._sum.rawWeight ?? 0);
  const sortedWeightToday =
    Number(sortingAgg._sum.gradeAWeight ?? 0) +
    Number(sortingAgg._sum.gradeBWeight ?? 0) +
    Number(sortingAgg._sum.gradeCWeight ?? 0) +
    Number(sortingAgg._sum.otherGradeWeight ?? 0);

  return {
    kpis: {
      totalItems,
      totalStock: Number(stockAgg._sum.currentStock ?? 0),
      stockValue: Number(stockValueAgg[0]?.value ?? 0),
      lowStock: Number(lowStockCount[0]?.count ?? 0),
      outOfStockItems,
      todaysInward,
      todaysOutward,
      totalVehicles,
      vehiclesInside,
      vehiclesOutside,
      vehiclesAvailable,
      vehiclesOnTrip,
      vehiclesUnderMaintenance,
      activeDrivers,
      availableDrivers,
      expiringDocuments: expiringVehicleDocs + expiringDriverDocs,
      expiredDocuments: expiredVehicleDocs + expiredDriverDocs,
      pendingApprovals: pendingApprovalsCount,
      todaysProcurement,
      inboundWeightToday: Number(inboundWeightAgg._sum.rawWeight ?? 0),
      purchaseValueToday: Number(purchaseValueAgg._sum.total ?? 0),
      activeVendors,
      pendingSortingBatches,
      rawWeightToday,
      sortedWeightToday,
      gradeAToday: Number(sortingAgg._sum.gradeAWeight ?? 0),
      gradeBToday: Number(sortingAgg._sum.gradeBWeight ?? 0),
      gradeCToday: Number(sortingAgg._sum.gradeCWeight ?? 0),
      yieldPercentToday: rawWeightToday > 0 ? Math.round((sortedWeightToday / rawWeightToday) * 10000) / 100 : 0,
      todaysWastage: Number(todaysWastage._sum.quantity ?? 0),
      pendingSalesOrders,
      approvedSalesOrders,
      todaysSalesOrders,
      readyForDispatchOrders,
      todaysTrips,
      tripsLoading,
      tripsDispatched,
      tripsReturnedToday,
      totalCrates,
      availableCrates,
      cratesWithCustomer,
      cratesReturned,
      cratesDamaged,
      cratesMissing,
      crateIssues: cratesDamaged + cratesMissing,
      overdueCrateReturns,
      expiringLicences,
      currentShiftName: currentShift?.shiftName ?? null,
      temperatureAlertsToday,
      fuelAnomalies,
      maintenanceDue,
    },
    trend: days,
    procurementTrend,
    salesTrend,
    wastageTrend,
    dispatchTrend,
    categoryChart,
    warehouseChart,
    gradeDistributionChart,
    fuelExpenseChart,
    maintenanceExpenseChart,
    recentLedger,
    lowStockList: lowStock,
    pendingApprovals,
    expiringDocuments,
    temperatureAlerts,
    fuelAnomalyRows: fuelAnomalyRowsFormatted,
  };
}
