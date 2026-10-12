"use client";

import { cloneElement, isValidElement, useId, useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORAGE_TYPES } from "@/lib/validators/item";
import { createItemAction, updateItemAction } from "@/lib/actions/item-actions";

const numOrBlank = z.union([z.literal(""), z.coerce.number()]);
const nonNegOrBlank = (label: string) =>
  z.union([z.literal(""), z.coerce.number().min(0, `${label} cannot be negative.`)]);

const formSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required."),
    itemCode: z.string().trim().min(1, "Item code is required."),
    name: z.string().trim().min(1, "Name is required."),
    categoryId: z.string().min(1, "Category is required."),
    brand: z.string().default(""),
    description: z.string().default(""),
    unit: z.string().trim().min(1, "Unit is required."),
    minStock: z.coerce.number().min(0, "Min stock cannot be negative.").default(0),
    maxStock: nonNegOrBlank("Max stock").default(""),
    reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative.").default(0),
    openingStock: z.coerce.number().min(0, "Opening stock cannot be negative.").default(0),
    warehouseId: z.string().default(""),
    locationId: z.string().default(""),
    supplierId: z.string().default(""),
    purchasePrice: nonNegOrBlank("Purchase price").default(""),
    taxPercent: z
      .union([z.literal(""), z.coerce.number().min(0, "Tax % cannot be negative.").max(100, "Tax % cannot exceed 100.")])
      .default(""),
    hsnCode: z.string().default(""),
    barcode: z.string().default(""),
    batchTracked: z.boolean().default(false),
    serialTracked: z.boolean().default(false),
    expiryTracked: z.boolean().default(false),
    imageUrl: z.string().default(""),
    isActive: z.boolean().default(true),
    isTemperatureSensitive: z.boolean().default(false),
    storageMinTempC: numOrBlank.default(""),
    storageMaxTempC: numOrBlank.default(""),
    storageType: z.string().default(""),
    storageLocationText: z.string().default(""),
    shelfLifeDays: z
      .union([
        z.literal(""),
        z.coerce.number().int("Shelf life must be a whole number of days.").min(0, "Shelf life cannot be negative."),
      ])
      .default(""),
  })
  .superRefine((d, ctx) => {
    if (d.maxStock !== "" && d.maxStock < d.minStock) {
      ctx.addIssue({ code: "custom", message: "Max stock cannot be less than min stock.", path: ["maxStock"] });
    }
    if (d.storageMinTempC !== "" && d.storageMaxTempC !== "" && d.storageMinTempC > d.storageMaxTempC) {
      ctx.addIssue({
        code: "custom",
        message: "Min temperature cannot be greater than max temperature.",
        path: ["storageMinTempC"],
      });
    }
  });

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export type CategoryOption = { id: string; name: string };
export type SupplierOption = { id: string; companyName: string; code: string };
export type WarehouseOption = {
  id: string;
  name: string;
  code: string;
  locations: { id: string; rack: string | null; shelf: string | null; bin: string | null }[];
};

export type ItemFormInitial = Partial<FormValues> & { id?: string };

function toFormNumber(v: number | null | undefined): number | "" {
  return v === null || v === undefined ? "" : v;
}

export function ItemForm({
  mode,
  categories,
  warehouses,
  suppliers,
  initial,
}: {
  mode: "create" | "edit";
  categories: CategoryOption[];
  warehouses: WarehouseOption[];
  suppliers: SupplierOption[];
  initial?: ItemFormInitial;
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sku: initial?.sku ?? "",
      itemCode: initial?.itemCode ?? "",
      name: initial?.name ?? "",
      categoryId: initial?.categoryId ?? "",
      brand: initial?.brand ?? "",
      description: initial?.description ?? "",
      unit: initial?.unit ?? "",
      minStock: toFormNumber(initial?.minStock as number | undefined) || 0,
      maxStock: initial?.maxStock ?? "",
      reorderLevel: toFormNumber(initial?.reorderLevel as number | undefined) || 0,
      openingStock: initial?.openingStock ?? 0,
      warehouseId: initial?.warehouseId ?? "",
      locationId: initial?.locationId ?? "",
      supplierId: initial?.supplierId ?? "",
      purchasePrice: initial?.purchasePrice ?? "",
      taxPercent: initial?.taxPercent ?? "",
      hsnCode: initial?.hsnCode ?? "",
      barcode: initial?.barcode ?? "",
      batchTracked: initial?.batchTracked ?? false,
      serialTracked: initial?.serialTracked ?? false,
      expiryTracked: initial?.expiryTracked ?? false,
      imageUrl: initial?.imageUrl ?? "",
      isActive: initial?.isActive ?? true,
      isTemperatureSensitive: initial?.isTemperatureSensitive ?? false,
      storageMinTempC: initial?.storageMinTempC ?? "",
      storageMaxTempC: initial?.storageMaxTempC ?? "",
      storageType: initial?.storageType ?? "",
      storageLocationText: initial?.storageLocationText ?? "",
      shelfLifeDays: initial?.shelfLifeDays ?? "",
    },
  });

  const selectedWarehouseId = watch("warehouseId");
  const isTempSensitive = watch("isTemperatureSensitive");

  const availableLocations = useMemo(() => {
    const wh = warehouses.find((w) => w.id === selectedWarehouseId);
    return wh?.locations ?? [];
  }, [warehouses, selectedWarehouseId]);

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const num = (v: number | "") => (v === "" ? null : v);

    const payload = {
      sku: values.sku,
      itemCode: values.itemCode,
      name: values.name,
      categoryId: values.categoryId,
      brand: values.brand || null,
      description: values.description || null,
      unit: values.unit,
      minStock: values.minStock,
      maxStock: num(values.maxStock),
      reorderLevel: values.reorderLevel,
      warehouseId: values.warehouseId || null,
      locationId: values.locationId || null,
      supplierId: values.supplierId || null,
      purchasePrice: num(values.purchasePrice),
      taxPercent: num(values.taxPercent),
      hsnCode: values.hsnCode || null,
      barcode: values.barcode || null,
      batchTracked: values.batchTracked,
      serialTracked: values.serialTracked,
      expiryTracked: values.expiryTracked,
      imageUrl: values.imageUrl || null,
      isActive: values.isActive,
      isTemperatureSensitive: values.isTemperatureSensitive,
      storageMinTempC: num(values.storageMinTempC),
      storageMaxTempC: num(values.storageMaxTempC),
      storageType: values.storageType || null,
      storageLocationText: values.storageLocationText || null,
      shelfLifeDays: num(values.shelfLifeDays),
    };

    const result = isEdit
      ? await updateItemAction(initial!.id!, payload)
      : await createItemAction({ ...payload, openingStock: values.openingStock });

    if (result.ok) {
      toast.success(isEdit ? "Item updated." : "Item created.");
      router.push(`/items/${result.data.id}`);
      router.refresh();
    } else {
      setServerError(result.error);
      toast.error(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SKU" error={errors.sku?.message}>
            <Input {...register("sku")} />
          </Field>
          <Field label="Item Code" error={errors.itemCode?.message}>
            <Input {...register("itemCode")} />
          </Field>
          <Field label="Name" error={errors.name?.message} className="sm:col-span-2 lg:col-span-1">
            <Input {...register("name")} />
          </Field>
          <Field label="Category" error={errors.categoryId?.message}>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Brand">
            <Input {...register("brand")} />
          </Field>
          <Field label="Unit" error={errors.unit?.message}>
            <Input {...register("unit")} placeholder="kg, pcs, box..." />
          </Field>
          <Field label="Description" className="sm:col-span-2 lg:col-span-3">
            <Textarea rows={2} {...register("description")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock &amp; Reorder</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Min Stock" error={errors.minStock?.message}>
            <Input type="number" step="any" {...register("minStock")} />
          </Field>
          <Field label="Max Stock" error={errors.maxStock?.message}>
            <Input type="number" step="any" {...register("maxStock")} />
          </Field>
          <Field label="Reorder Level" error={errors.reorderLevel?.message}>
            <Input type="number" step="any" {...register("reorderLevel")} />
          </Field>
          {!isEdit && (
            <Field label="Opening Stock" error={errors.openingStock?.message}>
              <Input type="number" step="any" {...register("openingStock")} />
            </Field>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Warehouse &amp; Location</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Warehouse">
            <Controller
              control={control}
              name="warehouseId"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => {
                    field.onChange(v === "none" ? "" : v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} — {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Location" error={errors.locationId?.message}>
            <Controller
              control={control}
              name="locationId"
              render={({ field }) => (
                <Select
                  value={field.value || "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  disabled={!selectedWarehouseId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={selectedWarehouseId ? "Unassigned" : "Select a warehouse first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {availableLocations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {[l.rack && `Rack ${l.rack}`, l.shelf && `Shelf ${l.shelf}`, l.bin && `Bin ${l.bin}`]
                          .filter(Boolean)
                          .join(" / ") || "Unnamed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Supplier">
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} — {s.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pricing &amp; Tax</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Purchase Price" error={errors.purchasePrice?.message}>
            <Input type="number" step="any" {...register("purchasePrice")} />
          </Field>
          <Field label="Tax %" error={errors.taxPercent?.message}>
            <Input type="number" step="any" {...register("taxPercent")} />
          </Field>
          <Field label="HSN Code">
            <Input {...register("hsnCode")} />
          </Field>
          <Field label="Barcode">
            <Input {...register("barcode")} placeholder="Auto-generatable on detail page" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracking</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6">
          <SwitchField control={control} name="batchTracked" label="Batch tracked" />
          <SwitchField control={control} name="serialTracked" label="Serial tracked" />
          <SwitchField control={control} name="expiryTracked" label="Expiry tracked" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage &amp; Temperature</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <SwitchField control={control} name="isTemperatureSensitive" label="Temperature sensitive" />
          </div>
          <Field label="Storage Type">
            <Controller
              control={control}
              name="storageType"
              render={({ field }) => (
                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Not set" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not set</SelectItem>
                    {STORAGE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Min Temp (°C)" error={errors.storageMinTempC?.message}>
            <Input type="number" step="any" disabled={!isTempSensitive} {...register("storageMinTempC")} />
          </Field>
          <Field label="Max Temp (°C)" error={errors.storageMaxTempC?.message}>
            <Input type="number" step="any" disabled={!isTempSensitive} {...register("storageMaxTempC")} />
          </Field>
          <Field label="Shelf Life (days)" error={errors.shelfLifeDays?.message}>
            <Input type="number" step="1" {...register("shelfLifeDays")} />
          </Field>
          <Field label="Storage Location (text)" className="sm:col-span-2 lg:col-span-4">
            <Input {...register("storageLocationText")} placeholder="e.g. Cold room B, aisle 3" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media &amp; Status</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Image URL">
            <Input {...register("imageUrl")} placeholder="https://..." />
          </Field>
          <div className="flex items-end">
            <SwitchField control={control} name="isActive" label="Active" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create item"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const autoId = useId();
  let content = children;
  let fieldId = autoId;
  if (isValidElement(children)) {
    const existingId = (children.props as { id?: string }).id;
    fieldId = existingId ?? autoId;
    if (!existingId) {
      content = cloneElement(children as ReactElement<{ id?: string }>, { id: fieldId });
    }
  }
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={fieldId}>{label}</Label>
      {content}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

type BooleanFieldName = {
  [K in keyof FormValues]: FormValues[K] extends boolean ? K : never;
}[keyof FormValues];

function SwitchField({
  control,
  name,
  label,
}: {
  control: Control<FormInput>;
  name: BooleanFieldName;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch checked={!!field.value} onCheckedChange={field.onChange} id={`switch-${name}`} />
        )}
      />
      <Label htmlFor={`switch-${name}`}>{label}</Label>
    </div>
  );
}
