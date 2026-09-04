import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Archive, Pencil, Truck, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { getDriverById } from "@/lib/services/driver";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { DriverFormDialog } from "@/components/drivers/driver-form-dialog";
import { DriverDocumentSection, type DriverDocumentRow } from "@/components/drivers/driver-document-section";
import { archiveDriverAction } from "@/lib/actions/driver-actions";

export const metadata = { title: "Driver Details" };

function toDateInputValue(date: Date | null | undefined): string | undefined {
  return date ? format(date, "yyyy-MM-dd") : undefined;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("DRIVER_VIEW");
  const { id } = await params;

  const [driver, currentVehicle, gateCount, fuelCount] = await Promise.all([
    getDriverById(id),
    prisma.vehicle.findFirst({
      where: { currentDriverId: id },
      select: { id: true, vehicleNumber: true, vehicleType: true, status: true },
    }),
    prisma.vehicleGateEntry.count({ where: { driverId: id } }),
    prisma.fuelEntry.count({ where: { driverId: id, isVoided: false } }),
  ]);

  if (!driver) notFound();

  const canEdit = user.permissions.includes("DRIVER_EDIT");
  const canArchive = user.permissions.includes("DRIVER_ARCHIVE");
  const canViewDocs = user.permissions.includes("DRIVER_DOCUMENT_VIEW");
  const canCreateDocs = user.permissions.includes("DRIVER_DOCUMENT_CREATE");
  const canEditDocs = user.permissions.includes("DRIVER_DOCUMENT_EDIT");
  const canRevealSensitive = user.permissions.includes("VIEW_SENSITIVE_DRIVER_DOCUMENTS");
  const canViewTrips = user.permissions.includes("TRIP_VIEW");
  const canViewVehicles = user.permissions.includes("VEHICLE_VIEW");
  const canViewAudit = user.permissions.includes("VIEW_AUDIT_LOG");

  const [trips, auditLogs] = await Promise.all([
    canViewTrips
      ? prisma.trip.findMany({
          where: { driverId: id },
          include: { customer: { select: { name: true } }, vehicle: { select: { vehicleNumber: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    canViewAudit
      ? prisma.auditLog.findMany({
          where: { entityType: "Driver", entityId: id },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
  ]);

  const documentRows: DriverDocumentRow[] = driver.documents.map((doc) => ({
    id: doc.id,
    docType: doc.docType,
    numberMasked: doc.numberMasked,
    licenceClass: doc.licenceClass ?? null,
    issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
    expiryDate: doc.expiryDate ? doc.expiryDate.toISOString() : null,
    issuingAuthority: doc.issuingAuthority ?? null,
    verificationStatus: doc.verificationStatus,
    isSensitive: doc.isSensitive,
    attachments: doc.attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedAt: attachment.uploadedAt.toISOString(),
      uploadedByName: attachment.uploadedBy.name,
    })),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={driver.fullName}
        description={driver.employeeId ? `Employee ID: ${driver.employeeId}` : "Driver profile"}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <DriverFormDialog
                mode="edit"
                driverId={driver.id}
                defaultValues={{
                  employeeId: driver.employeeId ?? undefined,
                  fullName: driver.fullName,
                  mobile: driver.mobile,
                  altMobile: driver.altMobile ?? undefined,
                  address: driver.address ?? undefined,
                  dob: toDateInputValue(driver.dob),
                  joiningDate: toDateInputValue(driver.joiningDate),
                  emergencyContact: driver.emergencyContact ?? undefined,
                  profilePhotoUrl: driver.profilePhotoUrl ?? undefined,
                  status: driver.status,
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                }
              />
            )}
            {canArchive && driver.status !== "INACTIVE" && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Archive className="h-4 w-4" /> Archive
                  </Button>
                }
                title="Archive this driver?"
                description="This sets the driver status to Inactive."
                confirmLabel="Archive"
                destructive
                onConfirm={archiveDriverAction.bind(null, driver.id)}
              />
            )}
          </div>
        }
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Overview</TabsTrigger>
          {canViewDocs && <TabsTrigger value="documents">Documents</TabsTrigger>}
          {canViewTrips && <TabsTrigger value="trips">Trips</TabsTrigger>}
          {canViewVehicles && <TabsTrigger value="vehicles">Vehicles</TabsTrigger>}
          {canViewAudit && <TabsTrigger value="audit">Audit</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Employee ID" value={driver.employeeId} />
              <Field label="Mobile" value={driver.mobile} />
              <Field label="Alt Mobile" value={driver.altMobile} />
              <Field label="Status" value={<StatusBadge status={driver.status} />} />
              <Field label="Date of Birth" value={driver.dob ? format(driver.dob, "dd MMM yyyy") : null} />
              <Field
                label="Joining Date"
                value={driver.joiningDate ? format(driver.joiningDate, "dd MMM yyyy") : null}
              />
              <Field label="Emergency Contact" value={driver.emergencyContact} />
              <Field
                label="Current Vehicle"
                value={
                  currentVehicle ? (
                    <Link href={`/vehicles/${currentVehicle.id}`} className="text-primary hover:underline">
                      {currentVehicle.vehicleNumber}
                    </Link>
                  ) : null
                }
              />
              <Field label="Gate Entries" value={gateCount.toLocaleString()} />
              <Field label="Fuel Entries" value={fuelCount.toLocaleString()} />
              <Field label="Profile Photo URL" value={driver.profilePhotoUrl} />
              <Field label="Address" value={driver.address} />
            </CardContent>
          </Card>
        </TabsContent>

        {canViewDocs && (
          <TabsContent value="documents" className="mt-4">
            <DriverDocumentSection
              driverId={driver.id}
              documents={documentRows}
              canCreate={canCreateDocs}
              canEdit={canEditDocs}
              canRevealSensitive={canRevealSensitive}
            />
          </TabsContent>
        )}

        {canViewTrips && (
          <TabsContent value="trips" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {trips.length === 0 ? (
                  <EmptyState icon={Truck} title="No trips recorded for this driver yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trip #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Departure</TableHead>
                        <TableHead>Delivered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {trips.map((trip) => (
                        <TableRow key={trip.id}>
                          <TableCell>
                            <Link href={`/dispatch/trips/${trip.id}`} className="font-medium text-primary hover:underline">
                              {trip.tripNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{trip.customer.name}</TableCell>
                          <TableCell className="text-muted-foreground">{trip.vehicle.vehicleNumber}</TableCell>
                          <TableCell>
                            <StatusBadge status={trip.status} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {trip.departureAt ? format(trip.departureAt, "dd MMM yyyy, HH:mm") : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {trip.deliveredAt ? format(trip.deliveredAt, "dd MMM yyyy, HH:mm") : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewVehicles && (
          <TabsContent value="vehicles" className="mt-4">
            <Card>
              <CardContent className="space-y-2 pt-4">
                {currentVehicle ? (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <Link href={`/vehicles/${currentVehicle.id}`} className="font-medium text-primary hover:underline">
                        {currentVehicle.vehicleNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{currentVehicle.vehicleType}</p>
                    </div>
                    <StatusBadge status={currentVehicle.status} />
                  </div>
                ) : (
                  <EmptyState icon={Truck} title="No vehicle currently assigned to this driver." />
                )}
                <p className="text-xs text-muted-foreground">
                  Showing the current assignment only — historical assignment tracking is not yet modeled.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewAudit && (
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {auditLogs.length === 0 ? (
                  <EmptyState icon={History} title="No audit history for this driver yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-muted-foreground">{format(a.createdAt, "dd MMM yyyy, HH:mm")}</TableCell>
                          <TableCell>
                            <StatusBadge status={a.action} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{a.user?.name ?? "System"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
