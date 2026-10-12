import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { paginationSchema, paginationMeta, isOneOf } from "@/lib/validators/common";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("SUPPLIER_VIEW");
  const user = await getSessionUser();
  const params = await searchParams;

  const pagination = paginationSchema.parse({
    page: params.page,
    pageSize: params.pageSize,
  });
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;

  const where: Prisma.SupplierWhereInput = {
    ...(isOneOf(status, ["ACTIVE", "INACTIVE"] as const) ? { status } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, suppliers] = await Promise.all([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: { companyName: "asc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: {
        id: true,
        code: true,
        companyName: true,
        contactPerson: true,
        phone: true,
        gstNumber: true,
        status: true,
      },
    }),
  ]);

  const canCreate = hasPermission(user, "SUPPLIER_CREATE");
  const canEdit = hasPermission(user, "SUPPLIER_EDIT");
  const canArchive = hasPermission(user, "SUPPLIER_ARCHIVE");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Manage supplier master records and their documents."
        actions={
          canCreate ? (
            <SupplierFormDialog
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4" /> New Supplier
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableSearchInput placeholder="Search by company name or code..." />
        <StatusFilterSelect
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
      </div>

      <SuppliersTable
        data={suppliers}
        pagination={paginationMeta(total, pagination)}
        canEdit={canEdit}
        canArchive={canArchive}
      />
    </div>
  );
}
