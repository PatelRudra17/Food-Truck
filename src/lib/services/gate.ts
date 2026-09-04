import { prisma } from "@/lib/prisma";
import type { GateActivityFilter } from "@/lib/validators/gate";

const entryInclude = {
  vehicle: true,
  driver: true,
  supplier: true,
  securityStaff: true,
} as const;

export async function getVehiclesCurrentlyInside() {
  return prisma.vehicleGateEntry.findMany({
    where: { status: "INSIDE" },
    include: entryInclude,
    orderBy: { timeIn: "desc" },
  });
}

export async function getVehiclesInsideCount() {
  return prisma.vehicleGateEntry.count({ where: { status: "INSIDE" } });
}

export async function getVehicleOptions() {
  return prisma.vehicle.findMany({
    select: { id: true, vehicleNumber: true, vehicleType: true, status: true },
    orderBy: { vehicleNumber: "asc" },
  });
}

export async function getDriverOptions() {
  return prisma.driver.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, fullName: true, mobile: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getSupplierOptions() {
  return prisma.supplier.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });
}

export type GateActivityRow = {
  kind: "IN" | "OUT";
  id: string;
  entryId: string;
  documentNumber: string;
  vehicleId: string;
  vehicleNumber: string;
  driverName: string;
  supplierName: string | null;
  eventTime: Date;
  detail: string | null;
};

/**
 * Combines VehicleGateEntry and VehicleGateExit rows into a single
 * chronological feed, filtered by an optional date range / vehicle, then
 * paginated in memory. Gate activity volume is small enough (per-vehicle,
 * per-visit events at a single depot gate) that this stays correct and fast
 * without needing a UNION query.
 */
export async function getRecentGateActivity(filter: GateActivityFilter) {
  const dateWhere: { gte?: Date; lte?: Date } = {};
  if (filter.from) dateWhere.gte = new Date(filter.from);
  if (filter.to) {
    const to = new Date(filter.to);
    to.setHours(23, 59, 59, 999);
    dateWhere.lte = to;
  }

  const entryWhere = {
    ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
    ...(filter.from || filter.to ? { timeIn: dateWhere } : {}),
  };
  const exitWhere = {
    ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
    ...(filter.from || filter.to ? { timeOut: dateWhere } : {}),
  };

  const [entries, exits, entryCount, exitCount] = await Promise.all([
    prisma.vehicleGateEntry.findMany({
      where: entryWhere,
      include: entryInclude,
      orderBy: { timeIn: "desc" },
      take: filter.page * filter.pageSize,
    }),
    prisma.vehicleGateExit.findMany({
      where: exitWhere,
      include: { vehicle: true, driver: true, gateEntry: true },
      orderBy: { timeOut: "desc" },
      take: filter.page * filter.pageSize,
    }),
    prisma.vehicleGateEntry.count({ where: entryWhere }),
    prisma.vehicleGateExit.count({ where: exitWhere }),
  ]);

  const rows: GateActivityRow[] = [
    ...entries.map((e): GateActivityRow => ({
      kind: "IN",
      id: e.id,
      entryId: e.id,
      documentNumber: e.gateEntryNumber,
      vehicleId: e.vehicleId,
      vehicleNumber: e.vehicle.vehicleNumber,
      driverName: e.driver.fullName,
      supplierName: e.supplier?.companyName ?? null,
      eventTime: e.timeIn,
      detail: e.purpose,
    })),
    ...exits.map((x): GateActivityRow => ({
      kind: "OUT",
      id: x.id,
      entryId: x.gateEntryId,
      documentNumber: x.gateExitNumber,
      vehicleId: x.vehicleId,
      vehicleNumber: x.vehicle.vehicleNumber,
      driverName: x.driver.fullName,
      supplierName: null,
      eventTime: x.timeOut,
      detail: x.destination,
    })),
  ].sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime());

  const total = entryCount + exitCount;
  const start = (filter.page - 1) * filter.pageSize;
  const paged = rows.slice(start, start + filter.pageSize);

  return { rows: paged, total };
}

export async function getGateEntryForPrint(entryId: string) {
  return prisma.vehicleGateEntry.findUnique({
    where: { id: entryId },
    include: {
      vehicle: true,
      driver: true,
      supplier: true,
      securityStaff: true,
      exit: true,
    },
  });
}
