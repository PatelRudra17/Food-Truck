import Link from "next/link";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { EmptyState } from "@/components/shared/empty-state";
import { paginationMeta, paginationSchema } from "@/lib/validators/common";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderOpen } from "lucide-react";

export const metadata = { title: "Documents" };

function attachmentEntityHref(attachment: {
  entityType: string;
  entityId: string;
  itemFk: string | null;
  supplierFk: string | null;
  vehicleFk: string | null;
  driverFk: string | null;
  inwardFk: string | null;
  outwardFk: string | null;
  adjustmentFk: string | null;
  fuelEntryFk: string | null;
  maintenanceFk: string | null;
  vehicleDocFk: string | null;
  driverDocFk: string | null;
  procurementFk: string | null;
  salesOrderFk: string | null;
  employeeFk: string | null;
  vehicleDoc?: { vehicleId: string } | null;
  driverDoc?: { driverId: string } | null;
}) {
  if (attachment.itemFk) return `/items/${attachment.itemFk}`;
  if (attachment.supplierFk) return `/suppliers/${attachment.supplierFk}`;
  if (attachment.vehicleFk) return `/vehicles/${attachment.vehicleFk}`;
  if (attachment.driverFk) return `/drivers/${attachment.driverFk}`;
  if (attachment.inwardFk) return `/stock/inward/${attachment.inwardFk}`;
  if (attachment.outwardFk) return `/stock/outward/${attachment.outwardFk}`;
  if (attachment.adjustmentFk) return `/stock/adjustment/${attachment.adjustmentFk}`;
  if (attachment.fuelEntryFk) return `/fuel`;
  if (attachment.maintenanceFk) return `/maintenance`;
  if (attachment.procurementFk) return `/procurement/${attachment.procurementFk}`;
  if (attachment.salesOrderFk) return `/sales/orders/${attachment.salesOrderFk}`;
  if (attachment.employeeFk) return `/employees/${attachment.employeeFk}`;
  if (attachment.vehicleDoc?.vehicleId) return `/vehicles/${attachment.vehicleDoc.vehicleId}`;
  if (attachment.driverDoc?.driverId) return `/drivers/${attachment.driverDoc.driverId}`;
  return null;
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("DOCUMENT_VIEW");
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const pagination = paginationSchema.parse({ page: get("page"), pageSize: get("pageSize") });
  const q = get("q")?.trim() || "";
  const entityType = get("entityType") || "";
  const documentType = get("documentType") || "";
  const sensitivity = get("sensitive") || "";

  const where = {
    isDeleted: false,
    ...(q
      ? {
          OR: [
            { fileName: { contains: q, mode: "insensitive" as const } },
            { entityType: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
            { documentType: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(entityType ? { entityType } : {}),
    ...(documentType ? { documentType } : {}),
    ...(sensitivity === "sensitive" ? { isSensitive: true } : sensitivity === "normal" ? { isSensitive: false } : {}),
  };

  const [total, attachments, entityTypes, documentTypes] = await Promise.all([
    prisma.attachment.count({ where }),
    prisma.attachment.findMany({
      where,
      include: {
        uploadedBy: { select: { name: true } },
        vehicleDoc: { select: { vehicleId: true } },
        driverDoc: { select: { driverId: true } },
      },
      orderBy: { uploadedAt: "desc" },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    }),
    prisma.attachment.findMany({
      where: { isDeleted: false },
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
    prisma.attachment.findMany({
      where: { isDeleted: false, documentType: { not: null } },
      distinct: ["documentType"],
      select: { documentType: true },
      orderBy: { documentType: "asc" },
    }),
  ]);

  const pager = paginationMeta(total, pagination);
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (entityType) params.set("entityType", entityType);
  if (documentType) params.set("documentType", documentType);
  if (sensitivity) params.set("sensitive", sensitivity);

  function pageHref(page: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    next.set("pageSize", String(pagination.pageSize));
    return `?${next.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Browse private attachments, expiry-sensitive files, and linked document records."
      />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TableSearchInput placeholder="Search by file name, entity, or document type..." />
          <TableFilterSelect
            paramKey="entityType"
            placeholder="All entity types"
            options={entityTypes.map((row) => ({ value: row.entityType, label: row.entityType }))}
          />
          <TableFilterSelect
            paramKey="documentType"
            placeholder="All document types"
            options={documentTypes
              .filter((row): row is { documentType: string } => !!row.documentType)
              .map((row) => ({ value: row.documentType, label: row.documentType.replaceAll("_", " ") }))}
          />
          <TableFilterSelect
            paramKey="sensitive"
            placeholder="All sensitivity"
            options={[
              { value: "sensitive", label: "Sensitive only" },
              { value: "normal", label: "Non-sensitive only" },
            ]}
          />
        </div>
      </div>

      {attachments.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No documents found"
          description="Try adjusting your filters or upload attachments from module detail pages."
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead>Sensitivity</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((attachment) => {
                  const href = attachmentEntityHref(attachment);
                  const canDownloadSensitive = !attachment.isSensitive || user.permissions.includes("VIEW_SENSITIVE_DRIVER_DOCUMENTS");
                  return (
                    <TableRow key={attachment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{attachment.fileName}</p>
                          <p className="text-xs text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(0)} KB</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{attachment.entityType}</p>
                          <p className="text-xs text-muted-foreground">{attachment.entityId}</p>
                        </div>
                      </TableCell>
                      <TableCell>{attachment.documentType?.replaceAll("_", " ") ?? "—"}</TableCell>
                      <TableCell>{attachment.expiryDate ? format(attachment.expiryDate, "dd MMM yyyy") : "—"}</TableCell>
                      <TableCell>{attachment.uploadedBy.name}</TableCell>
                      <TableCell>{format(attachment.uploadedAt, "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell>{attachment.isSensitive ? "Sensitive" : "Standard"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {href && (
                            <Button asChild variant="outline" size="sm">
                              <Link href={href}>Open Entity</Link>
                            </Button>
                          )}
                          <Button asChild variant="outline" size="sm" disabled={!canDownloadSensitive}>
                            <a href={canDownloadSensitive ? `/api/documents/${attachment.id}` : undefined}>
                              {canDownloadSensitive ? "Download" : "Restricted"}
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Showing {(pager.page - 1) * pager.pageSize + 1}–
              {Math.min(pager.page * pager.pageSize, pager.total)} of {pager.total}
            </p>
            <div className="flex gap-2">
              {/* `disabled` has no effect on a Link, so render a plain disabled button at the ends. */}
              {pager.page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(pager.page - 1)}>Previous</Link>
                </Button>
              )}
              {pager.page >= pager.pageCount ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(pager.page + 1)}>Next</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
