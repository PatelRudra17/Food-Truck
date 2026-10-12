"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Grade } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createTripSchema, type CreateTripInput } from "@/lib/validators/trip";
import { createTripAction, previewTripEligibilityAction, type TripEligibilityPreview } from "@/lib/actions/trip-actions";
import { GRADE_LABELS } from "@/lib/validators/wastage";

const NONE = "__none__";

export type CustomerOption = { id: string; name: string; customerCode: string };
export type RouteOption = { id: string; name: string; routeNumber: string };
export type VehicleOption = { id: string; vehicleNumber: string };
export type DriverOption = { id: string; fullName: string };
export type StaffOption = { id: string; name: string };
export type ItemOption = { id: string; name: string; sku: string; unit: string; hasWarehouse: boolean };
export type SalesOrderOption = {
  id: string;
  soNumber: string;
  customerId: string;
  items: { salesOrderItemId: string; itemId: string; itemName: string; grade: string; remainingQty: number }[];
};

type TripFormInput = z.input<typeof createTripSchema>;

function emptyLine() {
  return { salesOrderItemId: null, itemId: "", grade: Grade.GRADE_A, quantity: 1, cratesCount: null };
}

export function TripForm({
  customers,
  routes,
  vehicles,
  drivers,
  staff,
  items,
  salesOrders,
  canOverride,
}: {
  customers: CustomerOption[];
  routes: RouteOption[];
  vehicles: VehicleOption[];
  drivers: DriverOption[];
  staff: StaffOption[];
  items: ItemOption[];
  salesOrders: SalesOrderOption[];
  canOverride: boolean;
}) {
  const router = useRouter();
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [eligibility, setEligibility] = useState<TripEligibilityPreview | null>(null);
  const [checking, setChecking] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TripFormInput, unknown, CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      salesOrderId: null,
      customerId: "",
      routeId: null,
      vehicleId: "",
      driverId: "",
      loadingStaffId: null,
      departureAt: "",
      expectedArrivalAt: "",
      remarks: "",
      items: [emptyLine()],
      overrideEligibility: false,
      eligibilityOverrideReason: "",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");
  const vehicleId = watch("vehicleId");
  const driverId = watch("driverId");
  const salesOrderId = watch("salesOrderId");
  const overrideEligibility = watch("overrideEligibility");

  // Debounced live eligibility preview whenever vehicle/driver/line-items change.
  useEffect(() => {
    const validLines = (watchedItems ?? []).filter((l) => l?.itemId && Number(l.quantity) > 0);
    if (!vehicleId || !driverId || validLines.length === 0) {
      setEligibility(null);
      return;
    }
    const handle = setTimeout(async () => {
      setChecking(true);
      const result = await previewTripEligibilityAction({
        vehicleId,
        driverId,
        items: validLines.map((l) => ({ itemId: l!.itemId, grade: String(l!.grade), quantity: Number(l!.quantity) })),
      });
      setChecking(false);
      if (result.ok) setEligibility(result.data);
    }, 500);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId, driverId, JSON.stringify(watchedItems)]);

  function handleSalesOrderChange(value: string) {
    if (value === NONE) {
      setValue("salesOrderId", null);
      // Lines keep their item/qty but are no longer tied to the (now unlinked) order.
      (watchedItems ?? []).forEach((_, index) => setValue(`items.${index}.salesOrderItemId`, null));
      return;
    }
    setValue("salesOrderId", value);
    const so = salesOrders.find((s) => s.id === value);
    if (so) {
      setValue("customerId", so.customerId);
      if (so.items.length > 0) {
        replace(
          so.items
            .filter((line) => line.remainingQty > 0)
            .map((line) => ({
              salesOrderItemId: line.salesOrderItemId,
              itemId: line.itemId,
              grade: line.grade as Grade,
              quantity: line.remainingQty,
              cratesCount: null,
            })),
        );
      }
    }
  }

  function handleItemSelect(index: number, itemId: string) {
    setValue(`items.${index}.itemId`, itemId);
    // A different item is no longer the sales order line it was pre-filled from.
    setValue(`items.${index}.salesOrderItemId`, null);
  }

  async function onSubmit(values: CreateTripInput) {
    const result = await createTripAction(values);
    if (result.ok) {
      toast.success("Trip created.");
      router.push(`/dispatch/trips/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  }

  const blocked = eligibility != null && !eligibility.allowed;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trip Details</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field>
                <FieldLabel>Link to Sales Order (optional)</FieldLabel>
                <Select value={salesOrderId ?? NONE} onValueChange={handleSalesOrderChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Ad-hoc dispatch (no sales order)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ad-hoc dispatch (no sales order)</SelectItem>
                    {salesOrders.map((so) => (
                      <SelectItem key={so.id} value={so.id}>
                        {so.soNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {salesOrders.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No sales orders available yet — this trip will be created as a standalone dispatch.
                  </p>
                )}
              </Field>

              <Field>
                <FieldLabel htmlFor="customerId">Customer *</FieldLabel>
                <Controller
                  name="customerId"
                  control={control}
                  render={({ field }) => (
                    // Locked to the sales order's customer while an order is linked.
                    <Select value={field.value} onValueChange={field.onChange} disabled={!!salesOrderId}>
                      <SelectTrigger id="customerId" className="w-full" aria-invalid={!!errors.customerId}>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.customerCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.customerId]} />
              </Field>

              <Field>
                <FieldLabel>Route (optional)</FieldLabel>
                <Controller
                  name="routeId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No route" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No route</SelectItem>
                        {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.routeNumber} — {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="vehicleId">Vehicle *</FieldLabel>
                <Controller
                  name="vehicleId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="vehicleId" className="w-full" aria-invalid={!!errors.vehicleId}>
                        <SelectValue placeholder="Select vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.vehicleNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.vehicleId]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="driverId">Driver *</FieldLabel>
                <Controller
                  name="driverId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="driverId" className="w-full" aria-invalid={!!errors.driverId}>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.driverId]} />
              </Field>

              <Field>
                <FieldLabel>Loading Staff (optional)</FieldLabel>
                <Controller
                  name="loadingStaffId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Unassigned</SelectItem>
                        {staff.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="departureAt">Planned Departure</FieldLabel>
                <Input id="departureAt" type="datetime-local" {...register("departureAt")} />
              </Field>

              <Field>
                <FieldLabel htmlFor="expectedArrivalAt">Expected Arrival</FieldLabel>
                <Input id="expectedArrivalAt" type="datetime-local" {...register("expectedArrivalAt")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" rows={2} {...register("remarks")} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Item</TableHead>
                  <TableHead className="w-36">Grade</TableHead>
                  <TableHead className="w-28">Quantity</TableHead>
                  <TableHead className="w-28">Crates</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = watchedItems?.[index];
                  const item = line?.itemId ? itemsById.get(line.itemId) : undefined;
                  return (
                    <TableRow key={field.id}>
                      <TableCell>
                        <Select value={line?.itemId || ""} onValueChange={(v) => handleItemSelect(index, v)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name} ({i.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {item && !item.hasWarehouse && (
                          <p className="mt-1 text-xs text-amber-600">No default warehouse — stock cannot be checked.</p>
                        )}
                        <FieldError errors={[errors.items?.[index]?.itemId]} />
                      </TableCell>
                      <TableCell>
                        <Controller
                          control={control}
                          name={`items.${index}.grade`}
                          render={({ field: gradeField }) => (
                            <Select value={gradeField.value} onValueChange={gradeField.onChange}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.values(Grade).map((g) => (
                                  <SelectItem key={g} value={g}>
                                    {GRADE_LABELS[g] ?? g}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.001" min="0" {...register(`items.${index}.quantity`)} />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          {...register(`items.${index}.cratesCount`)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={fields.length === 1}
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
            <Plus className="h-4 w-4" /> Add Line
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispatch Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking vehicle, driver and stock eligibility...
            </p>
          )}
          {!checking && eligibility == null && (
            <p className="text-sm text-muted-foreground">
              Select a vehicle, driver and at least one line item to run the eligibility check.
            </p>
          )}
          {!checking && eligibility != null && eligibility.allowed && (
            <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Vehicle, driver and stock are eligible for dispatch.
            </p>
          )}
          {!checking && blocked && (
            <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" /> Dispatch blocked
              </p>
              <ul className="ml-5 list-disc space-y-1 text-sm text-destructive">
                {eligibility!.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {blocked && canOverride && (
            <div className="space-y-2 border-t pt-3">
              <Controller
                control={control}
                name="overrideEligibility"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(checked === true)} />
                    Override this block and proceed anyway
                  </label>
                )}
              />
              {Boolean(overrideEligibility) && (
                <Field>
                  <FieldLabel htmlFor="eligibilityOverrideReason">Override reason *</FieldLabel>
                  <Textarea
                    id="eligibilityOverrideReason"
                    rows={2}
                    placeholder="Explain why this trip is being dispatched despite the block above..."
                    {...register("eligibilityOverrideReason")}
                  />
                  <FieldError errors={[errors.eligibilityOverrideReason]} />
                </Field>
              )}
            </div>
          )}
          {blocked && !canOverride && (
            <p className="text-sm text-muted-foreground">
              You do not hold override permissions for this block — ask a manager to override or resolve the issue above.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/dispatch")}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || (blocked && !overrideEligibility)}>
          {isSubmitting ? "Creating..." : "Create Trip"}
        </Button>
      </div>
    </form>
  );
}
