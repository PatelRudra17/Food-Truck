"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { WASTE_REASON_LABELS } from "@/lib/validators/wastage";

const STAGE_OPTIONS = [
  { value: "SORTING", label: "Sorting" },
  { value: "WAREHOUSE", label: "Warehouse" },
];

const REASON_OPTIONS = Object.entries(WASTE_REASON_LABELS).map(([value, label]) => ({ value, label }));

export function WastageFilters({
  itemOptions,
  initial,
}: {
  itemOptions: { id: string; name: string }[];
  initial: { itemId: string; dateFrom: string; dateTo: string };
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

  return (
    <div className="flex flex-wrap items-end gap-3">
      <TableFilterSelect paramKey="stage" placeholder="All stages" options={STAGE_OPTIONS} />
      <TableFilterSelect paramKey="reason" placeholder="All reasons" options={REASON_OPTIONS} />
      <TableFilterSelect
        paramKey="itemId"
        placeholder="All items"
        className="w-56"
        options={itemOptions.map((i) => ({ value: i.id, label: i.name }))}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="dateFrom"
          type="date"
          className="w-40"
          defaultValue={initial.dateFrom}
          onChange={(e) => setParam("dateFrom", e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="dateTo"
          type="date"
          className="w-40"
          defaultValue={initial.dateTo}
          onChange={(e) => setParam("dateTo", e.target.value)}
        />
      </div>
      {(searchParams.get("stage") ||
        searchParams.get("reason") ||
        searchParams.get("itemId") ||
        searchParams.get("dateFrom") ||
        searchParams.get("dateTo")) && (
        <Button variant="ghost" size="sm" onClick={() => router.push("?page=1")}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
