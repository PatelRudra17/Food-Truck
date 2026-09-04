"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const ALL_VEHICLES = "__all__";

export function GateActivityFilters({
  vehicles,
}: {
  vehicles: { id: string; label: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("page", "1");
    startTransition(() => router.push(`?${params.toString()}`));
  }

  const hasFilters = Boolean(
    searchParams.get("from") || searchParams.get("to") || searchParams.get("vehicleId"),
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">From</label>
        <Input
          type="date"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">To</label>
        <Input
          type="date"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value || null)}
          className="w-40"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Vehicle</label>
        <Select
          value={searchParams.get("vehicleId") ?? ALL_VEHICLES}
          onValueChange={(v) => update("vehicleId", v === ALL_VEHICLES ? null : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All vehicles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
            {vehicles.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => startTransition(() => router.push("?page=1"))}
        >
          <X /> Clear filters
        </Button>
      )}
    </div>
  );
}
