import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getVehicleById, listActiveDriversForSelect } from "@/lib/services/vehicle";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { VehicleFormDialog } from "@/components/vehicles/vehicle-form-dialog";
import { VehicleDocumentSection, type VehicleDocumentRow } from "@/components/vehicles/vehicle-document-section";
import { archiveVehicleAction } from "@/lib/actions/vehicle-actions";
import { Archive, Pencil, Truck, Fuel, Wrench, DoorOpen, History } from "lucide-react";

export const metadata = { title: "Vehicle Details" };

function toDateInputValue(date: Date | null | undefined): string | undefined {
  return date ? format(date, "yyyy-MM-dd") : undefined;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "—"}</p>
    </div>
  );
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VEHICLE_VIEW");
  const { id } = await params;

  const [vehicle, drivers] = await Promise.all([getVehicleById(id), listActiveDriversForSelect()]);
  if (!vehicle) notFound();

  const canEdit = user.permissions.includes("VEHICLE_EDIT");
  const canArchive = user.permissions.includes("VEHICLE_ARCHIVE");
  const canViewDocs = user.permissions.includes("VEHICLE_DOCUMENT_VIEW");
  const canCreateDocs = user.permissions.includes("VEHICLE_DOCUMENT_CREATE");
  const canEditDocs = user.permissions.includes("VEHICLE_DOCUMENT_EDIT");
  const canViewTrips = user.permissions.includes("TRIP_VIEW");
  const canViewFuel = user.permissions.includes("FUEL_VIEW");
  const canViewMaintenance = user.permissions.includes("MAINTENANCE_VIEW");
  const canViewGate = user.permissions.includes("GATE_ENTRY_VIEW");
  const canViewAudit = user.permissions.includes("VIEW_AUDIT_LOG");

  const [trips, fuelEntries, maintenanceRecords, gateEntries, auditLogs] = await Promise.all([
    canViewTrips
      ? prisma.trip.findMany({
          where: { vehicleId: id },
          include: { customer: { select: { name: true } }, driver: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    canViewFuel
      ? prisma.fuelEntry.findMany({
          where: { vehicleId: id },
          orderBy: { date: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    canViewMaintenance
      ? prisma.vehicleMaintenance.findMany({
          where: { vehicleId: id },
          orderBy: { serviceDate: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    canViewGate
      ? prisma.vehicleGateEntry.findMany({
          where: { vehicleId: id },
          include: { driver: { select: { fullName: true } }, exit: true },
          orderBy: { timeIn: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    canViewAudit
      ? prisma.auditLog.findMany({
          where: { entityType: "Vehicle", entityId: id },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
  ]);

  const documentRows: VehicleDocumentRow[] = vehicle.documents.map((doc) => ({
    id: doc.id,
    docType: doc.docType,
    docNumber: doc.docNumber,
    issueDate: doc.issueDate ? doc.issueDate.toISOString() : null,
    expiryDate: doc.expiryDate ? doc.expiryDate.toISOString() : null,
    verificationStatus: doc.verificationStatus,
    attachments: doc.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      uploadedAt: a.uploadedAt.toISOString(),
      uploadedByName: a.uploadedBy.name,
    })),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={vehicle.vehicleNumber}
        description={[vehicle.vehicleType, vehicle.manufacturer, vehicle.model].filter(Boolean).join(" · ")}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <VehicleFormDialog
                mode="edit"
                vehicleId={vehicle.id}
                drivers={drivers}
                defaultValues={{
                  vehicleNumber: vehicle.vehicleNumber,
                  vehicleType: vehicle.vehicleType,
                  manufacturer: vehicle.manufacturer ?? undefined,
                  model: vehicle.model ?? undefined,
                  ownerCompany: vehicle.ownerCompany ?? undefined,
                  registrationDate: toDateInputValue(vehicle.registrationDate),
                  registrationExpiry: toDateInputValue(vehicle.registrationExpiry),
                  insuranceExpiry: toDateInputValue(vehicle.insuranceExpiry),
                  pucExpiry: toDateInputValue(vehicle.pucExpiry),
                  fitnessExpiry: toDateInputValue(vehicle.fitnessExpiry),
                  permitExpiry: toDateInputValue(vehicle.permitExpiry),
                  capacity: vehicle.capacity ?? undefined,
                  currentDriverId: vehicle.currentDriverId ?? undefined,
                  currentLocation: vehicle.currentLocation ?? undefined,
                  status: vehicle.status,
                  imageUrl: vehicle.imageUrl ?? undefined,
                }}
                trigger={
                  <Button size="sm" variant="outline">
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                }
              />
            )}
            {canArchive && vehicle.status !== "INACTIVE" && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="destructive">
                    <Archive className="h-4 w-4" /> Archive
                  </Button>
                }
                title="Archive this vehicle?"
                description="This sets the vehicle status to Inactive."
                confirmLabel="Archive"
                destructive
                onConfirm={archiveVehicleAction.bind(null, vehicle.id)}
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
          {canViewFuel && <TabsTrigger value="fuel">Fuel</TabsTrigger>}
          {canViewMaintenance && <TabsTrigger value="maintenance">Maintenance</TabsTrigger>}
          {canViewGate && <TabsTrigger value="gate">Gate History</TabsTrigger>}
          {canViewAudit && <TabsTrigger value="audit">Audit</TabsTrigger>}
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Vehicle Number" value={vehicle.vehicleNumber} />
              <Field label="Vehicle Type" value={vehicle.vehicleType} />
              <Field label="Manufacturer" value={vehicle.manufacturer} />
              <Field label="Model" value={vehicle.model} />
              <Field label="Owner Company" value={vehicle.ownerCompany} />
              <Field label="Capacity" value={vehicle.capacity} />
              <Field
                label="Current Driver"
                value={
                  vehicle.currentDriver ? (
                    <Link href={`/drivers/${vehicle.currentDriver.id}`} className="text-primary hover:underline">
                      {vehicle.currentDriver.fullName}
                    </Link>
                  ) : null
                }
              />
              <Field label="Current Location" value={vehicle.currentLocation} />
              <Field label="Current KM" value={Number(vehicle.odometerKm).toLocaleString()} />
              <Field label="Status" value={<StatusBadge status={vehicle.status} />} />
              <Field label="Maintenance State" value={<StatusBadge status={vehicle.maintenanceState} />} />
              <Field
                label="Registration Date"
                value={vehicle.registrationDate ? format(vehicle.registrationDate, "dd MMM yyyy") : null}
              />
              <Field
                label="Registration Expiry"
                value={
                  vehicle.registrationExpiry ? (
                    <span className="inline-flex items-center gap-2">
                      {format(vehicle.registrationExpiry, "dd MMM yyyy")}
                      <ExpiryBadge date={vehicle.registrationExpiry} />
                    </span>
                  ) : null
                }
              />
              <Field
                label="Insurance Expiry"
                value={
                  vehicle.insuranceExpiry ? (
                    <span className="inline-flex items-center gap-2">
                      {format(vehicle.insuranceExpiry, "dd MMM yyyy")}
                      <ExpiryBadge date={vehicle.insuranceExpiry} />
                    </span>
                  ) : null
                }
              />
              <Field
                label="PUC Expiry"
                value={
                  vehicle.pucExpiry ? (
                    <span className="inline-flex items-center gap-2">
                      {format(vehicle.pucExpiry, "dd MMM yyyy")}
                      <ExpiryBadge date={vehicle.pucExpiry} />
                    </span>
                  ) : null
                }
              />
              <Field
                label="Fitness Expiry"
                value={
                  vehicle.fitnessExpiry ? (
                    <span className="inline-flex items-center gap-2">
                      {format(vehicle.fitnessExpiry, "dd MMM yyyy")}
                      <ExpiryBadge date={vehicle.fitnessExpiry} />
                    </span>
                  ) : null
                }
              />
              <Field
                label="Permit Expiry"
                value={
                  vehicle.permitExpiry ? (
                    <span className="inline-flex items-center gap-2">
                      {format(vehicle.permitExpiry, "dd MMM yyyy")}
                      <ExpiryBadge date={vehicle.permitExpiry} />
                    </span>
                  ) : null
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {canViewDocs && (
          <TabsContent value="documents" className="mt-4">
            <VehicleDocumentSection
              vehicleId={vehicle.id}
              documents={documentRows}
              canCreate={canCreateDocs}
              canEdit={canEditDocs}
            />
          </TabsContent>
        )}

        {canViewTrips && (
          <TabsContent value="trips" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {trips.length === 0 ? (
                  <EmptyState icon={Truck} title="No trips recorded for this vehicle yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trip #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Driver</TableHead>
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
                          <TableCell className="text-muted-foreground">{trip.driver.fullName}</TableCell>
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

        {canViewFuel && (
          <TabsContent value="fuel" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {fuelEntries.length === 0 ? (
                  <EmptyState icon={Fuel} title="No fuel entries recorded for this vehicle yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Distance (KM)</TableHead>
                        <TableHead className="text-right">Fuel (L)</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-right">Mileage (KM/L)</TableHead>
                        <TableHead className="text-right">Cost/KM</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fuelEntries.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="text-muted-foreground">{format(f.date, "dd MMM yyyy")}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(f.distanceKm).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">{Number(f.fuelQuantityLiters).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">₹{Number(f.totalFuelCost).toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {f.mileageKmpl !== null ? Number(f.mileageKmpl).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {f.fuelCostPerKm !== null ? Number(f.fuelCostPerKm).toFixed(2) : "—"}
                          </TableCell>
                          <TableCell>
                            {f.isVoided ? (
                              <StatusBadge status="VOIDED" />
                            ) : f.isAnomaly ? (
                              <StatusBadge status="ANOMALY" />
                            ) : (
                              <StatusBadge status="NORMAL" />
                            )}
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

        {canViewMaintenance && (
          <TabsContent value="maintenance" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {maintenanceRecords.length === 0 ? (
                  <EmptyState icon={Wrench} title="No maintenance records for this vehicle yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Service Center</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceRecords.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-muted-foreground">{format(m.serviceDate, "dd MMM yyyy")}</TableCell>
                          <TableCell>{m.maintenanceType.replaceAll("_", " ")}</TableCell>
                          <TableCell className="text-muted-foreground">{m.serviceCenterVendor ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">₹{Number(m.totalCost).toLocaleString()}</TableCell>
                          <TableCell>{m.isArchived ? <StatusBadge status="ARCHIVED" /> : <StatusBadge status="RECORDED" />}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {canViewGate && (
          <TabsContent value="gate" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {gateEntries.length === 0 ? (
                  <EmptyState icon={DoorOpen} title="No gate entries recorded for this vehicle yet." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Gate Entry #</TableHead>
                        <TableHead>Driver</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Time In</TableHead>
                        <TableHead>Time Out</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gateEntries.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium">{g.gateEntryNumber}</TableCell>
                          <TableCell className="text-muted-foreground">{g.driver.fullName}</TableCell>
                          <TableCell className="text-muted-foreground">{g.purpose ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{format(g.timeIn, "dd MMM yyyy, HH:mm")}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {g.exit ? format(g.exit.timeOut, "dd MMM yyyy, HH:mm") : "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={g.status} />
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

        {canViewAudit && (
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                {auditLogs.length === 0 ? (
                  <EmptyState icon={History} title="No audit history for this vehicle yet." />
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
