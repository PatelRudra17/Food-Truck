"use client";

import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATE_FORMAT_OPTIONS, systemSettingsSchema, type SystemSettingsInput } from "@/lib/validators/settings";
import { saveSystemSettingsAction, uploadCompanyLogoAction } from "@/lib/actions/settings-actions";

type SettingsFormInput = z.input<typeof systemSettingsSchema>;

export function SystemSettingsForm({
  initialValues,
  companyLogoStorageKey,
}: {
  initialValues: SystemSettingsInput;
  companyLogoStorageKey: string | null;
}) {
  const [warningDaysText, setWarningDaysText] = useState(initialValues.documentExpiryWarningDays.join(", "));
  const [warningDaysError, setWarningDaysError] = useState<string | null>(null);
  const [logoPending, startLogoTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormInput, unknown, SystemSettingsInput>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: initialValues,
  });

  const dateFormat = watch("dateFormat");
  const allowNegativeStock = watch("allowNegativeStock");

  function parseWarningDays() {
    const parsed = warningDaysText
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));

    const checked = systemSettingsSchema.shape.documentExpiryWarningDays.safeParse(parsed);
    if (!checked.success) {
      setWarningDaysError(checked.error.issues[0]?.message ?? "Enter valid day thresholds.");
      return null;
    }

    setWarningDaysError(null);
    return checked.data;
  }

  async function onSubmit(values: SystemSettingsInput) {
    const days = parseWarningDays();
    if (!days) return;

    const result = await saveSystemSettingsAction({
      ...values,
      documentExpiryWarningDays: days,
    });

    if (result.ok) {
      toast.success("Settings saved.");
    } else {
      toast.error(result.error);
    }
  }

  async function handleLogoUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose an image before uploading.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startLogoTransition(async () => {
      const result = await uploadCompanyLogoAction(formData);
      if (result.ok) {
        toast.success("Company logo uploaded.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" {...register("companyName")} />
                {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" {...register("currency")} />
                {errors.currency && <p className="text-xs text-destructive">{errors.currency.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Select value={dateFormat} onValueChange={(value) => setValue("dateFormat", value)}>
                  <SelectTrigger id="dateFormat" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMAT_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="timeZone">Time Zone</Label>
                <Input id="timeZone" {...register("timeZone")} />
                {errors.timeZone && <p className="text-xs text-destructive">{errors.timeZone.message}</p>}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="documentExpiryWarningDays">Document Expiry Warning Days</Label>
              <Input
                id="documentExpiryWarningDays"
                value={warningDaysText}
                onChange={(event) => setWarningDaysText(event.target.value)}
                placeholder="7, 15, 30"
              />
              <p className="text-xs text-muted-foreground">Comma-separated day thresholds used for expiry alerts.</p>
              {warningDaysError && <p className="text-xs text-destructive">{warningDaysError}</p>}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Allow Negative Stock</p>
                <p className="text-xs text-muted-foreground">
                  Controls whether issue/transfer flows can move inventory below zero.
                </p>
              </div>
              <Switch
                checked={allowNegativeStock}
                onCheckedChange={(checked) => setValue("allowNegativeStock", checked)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="highWastageThresholdPercent">High Wastage Threshold (%)</Label>
                <Input
                  id="highWastageThresholdPercent"
                  type="number"
                  min={1}
                  max={100}
                  {...register("highWastageThresholdPercent")}
                />
                <p className="text-xs text-muted-foreground">
                  A sorting batch losing more than this share of its raw weight notifies the Store Manager.
                </p>
                {errors.highWastageThresholdPercent && (
                  <p className="text-xs text-destructive">{errors.highWastageThresholdPercent.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="crateOverdueThresholdDays">Crate Overdue Threshold (days)</Label>
                <Input
                  id="crateOverdueThresholdDays"
                  type="number"
                  min={1}
                  max={90}
                  {...register("crateOverdueThresholdDays")}
                />
                <p className="text-xs text-muted-foreground">
                  Crates still with a customer past this many days trigger an overdue alert.
                </p>
                {errors.crateOverdueThresholdDays && (
                  <p className="text-xs text-destructive">{errors.crateOverdueThresholdDays.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="companyLogo">Company Logo</Label>
            <Input
              id="companyLogo"
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Supported: PNG, JPG, JPEG, PDF. Stored privately in object storage.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={handleLogoUpload} disabled={logoPending}>
            <Upload className="h-4 w-4" /> {logoPending ? "Uploading..." : "Upload Logo"}
          </Button>

          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">Current Logo Storage Key</p>
            <p className="break-all text-muted-foreground">{companyLogoStorageKey ?? "No logo uploaded yet."}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
