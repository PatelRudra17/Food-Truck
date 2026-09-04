"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export function TemperatureFiltersBar({
  warehouses,
  locations,
  items,
}: {
  warehouses: { id: string; name: string }[];
  locations: { id: string; warehouseId: string; label: string }[];
  items: { id: string; name: string; sku: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [batch, setBatch] = useState(searchParams.get("batchNumber") ?? "");

  const warehouseId = searchParams.get("warehouseId") ?? "";
  const locationId = searchParams.get("locationId") ?? "";
  const itemId = searchParams.get("itemId") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const locationsForWarehouse = useMemo(
    () => (warehouseId ? locations.filter((l) => l.warehouseId === warehouseId) : locations),
    [locations, warehouseId],
  );

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    startTransition(() => router.push(`?${params.toString()}`));
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (batch !== (searchParams.get("batchNumber") ?? "")) setParam("batchNumber", batch);
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch]);

  const hasFilters = warehouseId || locationId || itemId || dateFrom || dateTo || batch;

  function clearAll() {
    setBatch("");
    startTransition(() => router.push("?page=1"));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Warehouse</Label>
        <Select
          value={warehouseId || "all"}
          onValueChange={(v) => {
            setParam("warehouseId", v === "all" ? "" : v);
            setParam("locationId", "");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All warehouses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Location</Label>
        <Select value={locationId || "all"} onValueChange={(v) => setParam("locationId", v === "all" ? "" : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {locationsForWarehouse.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Item</Label>
        <Select value={itemId || "all"} onValueChange={(v) => setParam("itemId", v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All items" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} ({i.sku})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="temp-filter-batch" className="text-xs text-muted-foreground">
          Batch number
        </Label>
        <Input
          id="temp-filter-batch"
          className="w-40"
          placeholder="Search batch..."
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="temp-filter-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="temp-filter-from"
          type="date"
          className="w-36"
          value={dateFrom}
          onChange={(e) => setParam("dateFrom", e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="temp-filter-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="temp-filter-to"
          type="date"
          className="w-36"
          value={dateTo}
          onChange={(e) => setParam("dateTo", e.target.value)}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
          <X className="h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
