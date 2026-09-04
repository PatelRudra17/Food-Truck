import "server-only";
import { prisma } from "@/lib/prisma";
import type { Pagination } from "@/lib/validators/common";
import { paginationMeta } from "@/lib/validators/common";
import type { Prisma, PersonStatus } from "@prisma/client";

export type DriverListFilters = {
  q?: string;
  status?: string;
};

export async function listDrivers(pagination: Pagination, filters: DriverListFilters) {
  const where: Prisma.DriverWhereInput = {};
  if (filters.q) {
    where.OR = [
      { fullName: { contains: filters.q, mode: "insensitive" } },
      { employeeId: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  if (filters.status) {
    where.status = filters.status as PersonStatus;
  }

  const [total, drivers] = await Promise.all([
    prisma.driver.count({ where }),
    prisma.driver.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      // Intentionally NOT selecting anything from DriverDocument here — the list
      // view must never show Aadhaar/PAN/licence data (spec requirement).
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        mobile: true,
        status: true,
        joiningDate: true,
      },
    }),
  ]);

  return { rows: drivers, pagination: paginationMeta(total, pagination) };
}

/**
 * Fetches a driver with documents for the detail page. Documents are mapped to
 * strip `numberEncrypted` before this ever reaches a Client Component — only
 * `numberMasked` (already-safe display text) is passed down. The plaintext is
 * only ever produced on-demand by `revealDriverDocumentNumber`.
 */
export async function getDriverById(id: string) {
  const driver = await prisma.driver.findUnique({
    where: { id },
    include: {
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
  if (!driver) return null;

  return {
    ...driver,
    documents: driver.documents.map((doc) => {
      const { numberEncrypted: _numberEncrypted, ...safe } = doc;
      return safe;
    }),
  };
}
