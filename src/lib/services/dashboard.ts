import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData() {
  const today = startOfToday();
  const in30 = new Date(Date.now() + 30 * 86400000);

  const [
    totalItems,
    outOfStockItems,
    todaysInward,
    todaysOutward,
    totalVehicles,
    vehiclesInside,
    vehiclesOutside,
    activeDrivers,
    pendingApprovals,
    expiringVehicleDocs,
    expiringDriverDocs,
    recentLedger,
    lowStockList,
    stockAgg,
  ] = await Promise.all([
    prisma.item.count({ where: { isActive: true } }),
    prisma.item.count({ where: { isActive: true, currentStock: { lte: 0 } } }),
    prisma.stockInward.count({ where: { date: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.stockOutward.count({ where: { date: { gte: today }, status: { not: "CANCELLED" } } }),
    prisma.vehicle.count(),
    prisma.vehicle.count({ where: { status: "INSIDE" } }),
    prisma.vehicle.count({ where: { status: { in: ["OUTSIDE", "ON_TRIP"] } } }),
    prisma.driver.count({ where: { status: "ACTIVE" } }),
    prisma.approval.count({ where: { decision: "PENDING" } }),
    prisma.vehicleDocument.count({ where: { expiryDate: { gte: today, lte: in30 } } }),
    prisma.driverDocument.count({ where: { expiryDate: { gte: today, lte: in30 } } }),
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
  ]);

  const lowStockCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) AS count FROM "Item" WHERE "isActive" = true AND "currentStock" <= "reorderLevel"
  `;
  const lowStock = lowStockList;

  const [inwardTrend, outwardTrend] = await Promise.all([
    prisma.inventoryLedger.groupBy({
      by: ["createdAt"],
      where: { transactionType: "INWARD", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      _sum: { quantity: true },
    }),
    prisma.inventoryLedger.groupBy({
      by: ["createdAt"],
      where: { transactionType: "OUTWARD", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      _sum: { quantity: true },
    }),
  ]);

  function bucketByDay(rows: { createdAt: Date; _sum: { quantity: Prisma.Decimal | null } }[]) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(row._sum.quantity ?? 0));
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

  return {
    kpis: {
      totalItems,
      totalStock: Number(stockAgg._sum.currentStock ?? 0),
      lowStock: Number(lowStockCount[0]?.count ?? 0),
      outOfStockItems,
      todaysInward,
      todaysOutward,
      totalVehicles,
      vehiclesInside,
      vehiclesOutside,
      activeDrivers,
      expiringDocuments: expiringVehicleDocs + expiringDriverDocs,
      pendingApprovals,
    },
    trend: days,
    categoryChart,
    warehouseChart,
    recentLedger,
    lowStockList: lowStock,
  };
}
