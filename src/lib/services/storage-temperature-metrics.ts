import "server-only";
import { dateParam } from "@/lib/validators/common";
import { prisma } from "@/lib/prisma";
import { Prisma, TemperatureStatus } from "@prisma/client";
import type { TemperatureLogFilters } from "@/lib/validators/storage-temperature";
import type { Pagination } from "@/lib/validators/common";

const STATUS_RANK: Record<TemperatureStatus, number> = {
  NORMAL: 0,
  WARNING: 1,
  CRITICAL: 2,
};

function worseStatus(a: TemperatureStatus, b: TemperatureStatus): TemperatureStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export function locationLabel(location: { rack: string | null; shelf: string | null; bin: string | null } | null) {
  if (!location) return null;
  const parts = [location.rack, location.shelf, location.bin].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : null;
}

/** Builds the shared Prisma where-clause used by the log list, Excel export and print view. */
export function buildTemperatureLogWhere(filters: TemperatureLogFilters): Prisma.StorageTemperatureLogWhereInput {
  const where: Prisma.StorageTemperatureLogWhereInput = {};
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.locationId) where.locationId = filters.locationId;
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.batchNumber) where.batchNumber = { contains: filters.batchNumber, mode: "insensitive" };
  const dateFrom = dateParam(filters.dateFrom);
  const dateTo = dateParam(filters.dateTo);
  if (dateFrom || dateTo) {
    where.recordedAt = {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
    };
  }
  return where;
}

const logListInclude = {
  item: { select: { id: true, name: true, sku: true, unit: true, storageMinTempC: true, storageMaxTempC: true } },
  warehouse: { select: { id: true, name: true } },
  location: { select: { id: true, rack: true, shelf: true, bin: true } },
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.StorageTemperatureLogInclude;

export async function getTemperatureLogList(filters: TemperatureLogFilters, pagination: Pagination) {
  const where = buildTemperatureLogWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.storageTemperatureLog.findMany({
      where,
      include: logListInclude,
      orderBy: { recordedAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.storageTemperatureLog.count({ where }),
  ]);
  return { rows, total };
}

/** Same filters, unpaginated — used by the Excel export and the print view. */
export async function getTemperatureLogListAll(filters: TemperatureLogFilters, cap = 5000) {
  const where = buildTemperatureLogWhere(filters);
  return prisma.storageTemperatureLog.findMany({
    where,
    include: logListInclude,
    orderBy: { recordedAt: "desc" },
    take: cap,
  });
}

/**
 * Latest StorageTemperatureLog per (item, warehouse) among temperature-sensitive,
 * active items — the backbone of the monitoring dashboard's "current conditions"
 * and "storage location status" sections. Reduced in JS from a bounded recent
 * window, which is more than sufficient at this catalog's scale and avoids a
 * raw DISTINCT ON query for a handful of dashboard cards.
 */
async function getLatestLogsBySensitiveItem() {
  const sensitiveItems = await prisma.item.findMany({
    where: { isTemperatureSensitive: true, isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      unit: true,
      storageMinTempC: true,
      storageMaxTempC: true,
      storageType: true,
      shelfLifeDays: true,
    },
    orderBy: { name: "asc" },
  });
  const itemIds = sensitiveItems.map((i) => i.id);
  if (itemIds.length === 0)
    return {
      sensitiveItems,
      latestLogs: [] as Prisma.StorageTemperatureLogGetPayload<{ include: typeof logListInclude }>[],
    };

  const logs = await prisma.storageTemperatureLog.findMany({
    where: { itemId: { in: itemIds } },
    include: logListInclude,
    orderBy: { recordedAt: "desc" },
    take: 3000,
  });

  const seen = new Set<string>();
  const latestLogs: typeof logs = [];
  for (const log of logs) {
    const key = `${log.itemId}::${log.warehouseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latestLogs.push(log);
  }

  return { sensitiveItems, latestLogs };
}

export async function getStorageTemperatureDashboard() {
  const [{ sensitiveItems, latestLogs }, batchesAtRisk] = await Promise.all([
    getLatestLogsBySensitiveItem(),
    prisma.storageTemperatureLog.findMany({
      where: { batchNumber: { not: null }, status: { in: ["WARNING", "CRITICAL"] } },
      include: logListInclude,
      orderBy: { recordedAt: "desc" },
      take: 50,
    }),
  ]);

  const alerts = latestLogs.filter((l) => l.status === "WARNING" || l.status === "CRITICAL");

  // Worst status per (warehouse, location) among the latest readings.
  const locationMap = new Map<
    string,
    { warehouseId: string; warehouseName: string; locationId: string | null; locationLabel: string | null; status: TemperatureStatus; itemCount: number }
  >();
  for (const log of latestLogs) {
    const key = `${log.warehouseId}::${log.locationId ?? "none"}`;
    const label = locationLabel(log.location);
    const existing = locationMap.get(key);
    if (existing) {
      existing.status = worseStatus(existing.status, log.status);
      existing.itemCount += 1;
    } else {
      locationMap.set(key, {
        warehouseId: log.warehouseId,
        warehouseName: log.warehouse.name,
        locationId: log.locationId,
        locationLabel: label,
        status: log.status,
        itemCount: 1,
      });
    }
  }
  const locationStatus = [...locationMap.values()].sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]);

  return {
    itemsMonitoredCount: sensitiveItems.length,
    latestLogs,
    alerts,
    criticalCount: alerts.filter((a) => a.status === "CRITICAL").length,
    warningCount: alerts.filter((a) => a.status === "WARNING").length,
    batchesAtRisk,
    locationStatus,
  };
}

export async function getItemTemperatureHistory(itemId: string, take = 200) {
  return prisma.storageTemperatureLog.findMany({
    where: { itemId },
    include: {
      warehouse: { select: { id: true, name: true } },
      location: { select: { id: true, rack: true, shelf: true, bin: true } },
      recordedBy: { select: { id: true, name: true } },
    },
    orderBy: { recordedAt: "desc" },
    take,
  });
}
