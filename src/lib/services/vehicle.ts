import "server-only";
import { prisma } from "@/lib/prisma";
import type { Pagination } from "@/lib/validators/common";
import { paginationMeta } from "@/lib/validators/common";
import { worstExpiryStatus } from "@/lib/expiry";
import { VehicleStatus, type Prisma } from "@prisma/client";

export type VehicleListFilters = {
  q?: string;
  status?: string;
  vehicleType?: string;
};

export async function listVehicles(pagination: Pagination, filters: VehicleListFilters) {
  const where: Prisma.VehicleWhereInput = {};
  if (filters.q) {
    where.vehicleNumber = { contains: filters.q, mode: "insensitive" };
  }
  // Ignore unknown ?status= values instead of letting Prisma reject them.
  if (filters.status && Object.values(VehicleStatus).includes(filters.status as VehicleStatus)) {
    where.status = filters.status as VehicleStatus;
  }
  if (filters.vehicleType) {
    where.vehicleType = { equals: filters.vehicleType.trim(), mode: "insensitive" };
  }

  const [total, vehicles, vehicleTypes] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      include: { currentDriver: { select: { id: true, fullName: true, employeeId: true } } },
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.vehicle.findMany({
      distinct: ["vehicleType"],
      select: { vehicleType: true },
      orderBy: { vehicleType: "asc" },
    }),
  ]);

  const rows = vehicles.map((v) => ({
    id: v.id,
    vehicleNumber: v.vehicleNumber,
    vehicleType: v.vehicleType,
    manufacturer: v.manufacturer,
    model: v.model,
    status: v.status,
    currentDriverName: v.currentDriver?.fullName ?? null,
    documentFlag: worstExpiryStatus([
      v.registrationExpiry,
      v.insuranceExpiry,
      v.pucExpiry,
      v.fitnessExpiry,
      v.permitExpiry,
    ]),
  }));

  return {
    rows,
    pagination: paginationMeta(total, pagination),
    // "Truck" and "truck " show once in the filter (matching is case-insensitive).
    vehicleTypes: [
      ...new Map(vehicleTypes.map((t) => [t.vehicleType.trim().toLowerCase(), t.vehicleType.trim()])).values(),
    ],
  };
}

export async function getVehicleById(id: string) {
  return prisma.vehicle.findUnique({
    where: { id },
    include: {
      currentDriver: { select: { id: true, fullName: true, employeeId: true } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: {
          attachments: {
            where: { isDeleted: false },
            orderBy: { uploadedAt: "desc" },
            include: { uploadedBy: { select: { name: true } } },
          },
        },
      },
    },
  });
}

export async function listActiveDriversForSelect() {
  return prisma.driver.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, fullName: true, employeeId: true },
    orderBy: { fullName: "asc" },
  });
}
