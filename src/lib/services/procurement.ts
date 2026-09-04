import { prisma } from "@/lib/prisma";

/**
 * Gate entries for a truck that is still on-site (INSIDE) and has at least
 * one linked Procurement, but has not yet had an Unloading record started.
 */
export async function getGateEntriesAwaitingUnloading() {
  return prisma.vehicleGateEntry.findMany({
    where: {
      status: "INSIDE",
      procurements: { some: {} },
      unloading: null,
    },
    include: {
      vehicle: { select: { vehicleNumber: true, vehicleType: true } },
      driver: { select: { fullName: true, mobile: true } },
      supplier: { select: { companyName: true } },
      procurements: { select: { id: true, procurementNumber: true, status: true } },
    },
    orderBy: { timeIn: "asc" },
  });
}

export async function getUnloadingsInProgress() {
  return prisma.unloading.findMany({
    where: { unloadingStartAt: { not: null }, unloadingEndAt: null },
    include: {
      vehicle: { select: { vehicleNumber: true } },
      driver: { select: { fullName: true } },
      supplier: { select: { companyName: true } },
      gateEntry: { select: { gateEntryNumber: true } },
    },
    orderBy: { unloadingStartAt: "asc" },
  });
}

export async function getCompletedUnloadings(pagination: { page: number; pageSize: number }) {
  const where = { unloadingEndAt: { not: null } } as const;
  const [total, rows] = await Promise.all([
    prisma.unloading.count({ where }),
    prisma.unloading.findMany({
      where,
      include: {
        vehicle: { select: { vehicleNumber: true } },
        driver: { select: { fullName: true } },
        supplier: { select: { companyName: true } },
        gateEntry: { select: { gateEntryNumber: true } },
        unloadingStaff: { select: { name: true } },
      },
      orderBy: { unloadingEndAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
  ]);
  return { rows, total };
}

/**
 * Full traceability chain for a single batch: vendor -> vehicle -> driver ->
 * gate entry -> procurement -> this batch -> sorting/wastage (populated once
 * the Sorting module, built in parallel, creates rows against this batch).
 */
export async function getProcurementBatchTrace(id: string) {
  return prisma.procurementBatch.findUnique({
    where: { id },
    include: {
      procurement: {
        select: {
          id: true,
          procurementNumber: true,
          date: true,
          status: true,
          invoiceNumber: true,
          createdBy: { select: { name: true } },
        },
      },
      procurementItem: { select: { quantity: true, unit: true, quality: true, purchasePrice: true, total: true } },
      supplier: { select: { id: true, companyName: true, code: true } },
      item: { select: { id: true, name: true, sku: true, unit: true } },
      vehicle: { select: { id: true, vehicleNumber: true, vehicleType: true } },
      driver: { select: { id: true, fullName: true, mobile: true } },
      gateEntry: { select: { id: true, gateEntryNumber: true, timeIn: true, purpose: true } },
      warehouse: { select: { id: true, name: true, code: true } },
      sorting: true,
      wastages: { orderBy: { createdAt: "desc" } },
    },
  });
}
