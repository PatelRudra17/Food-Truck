"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FUEL_TYPES } from "@/lib/validators/fuel";

export function FuelFilters({
  vehicleOptions,
  driverOptions,
  initial,
}: {
  vehicleOptions: { id: string; vehicleNumber: string }[];
  driverOptions: { id: string; fullName: string }[];
  initial: {
    vehicleId: string;
    driverId: string;
    fuelType: string;
    fuelStation: string;
    dateFrom: string;
    dateTo: string;
    showVoided: boolean;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function clearAll() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Vehicle</Label>
        <Select value={initial.vehicleId || "all"} onValueChange={(v) => setParam("vehicleId", v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All vehicles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {vehicleOptions.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.vehicleNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Driver</Label>
        <Select value={initial.driverId || "all"} onValueChange={(v) => setParam("driverId", v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All drivers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All drivers</SelectItem>
            {driverOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Fuel type</Label>
        <Select value={initial.fuelType || "all"} onValueChange={(v) => setParam("fuelType", v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FUEL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Fuel station</Label>
        <Input
          className="w-[160px]"
          defaultValue={initial.fuelStation}
          placeholder="Station / vendor"
          onBlur={(e) => setParam("fuelStation", e.target.value.trim())}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          className="w-[150px]"
          defaultValue={initial.dateFrom}
          onChange={(e) => setParam("dateFrom", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          className="w-[150px]"
          defaultValue={initial.dateTo}
          onChange={(e) => setParam("dateTo", e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <Switch
          id="show-voided"
          checked={initial.showVoided}
          onCheckedChange={(v) => setParam("showVoided", v ? "1" : "")}
        />
        <Label htmlFor="show-voided" className="text-xs">
          Show voided
        </Label>
      </div>

      <Button variant="ghost" size="sm" onClick={clearAll} className="mb-0.5">
        Clear filters
      </Button>
    </div>
  );
}
