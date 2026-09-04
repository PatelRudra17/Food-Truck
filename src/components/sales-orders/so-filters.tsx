"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/shared/table-search-input";
import { StatusFilterSelect } from "@/components/shared/status-filter-select";
import { TableFilterSelect } from "@/components/shared/table-filter-select";

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "READY_FOR_DISPATCH", label: "Ready for Dispatch" },
  { value: "PARTIALLY_FULFILLED", label: "Partially Fulfilled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function SalesOrderFilters({
  customerOptions,
  initial,
}: {
  customerOptions: { id: string; name: string }[];
  initial: { dateFrom: string; dateTo: string };
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

  const hasFilters =
    searchParams.get("status") ||
    searchParams.get("customerId") ||
    searchParams.get("dateFrom") ||
    searchParams.get("dateTo") ||
    searchParams.get("q");

  return (
    <div className="flex flex-wrap items-end gap-3">
      <TableSearchInput placeholder="Search by SO number or customer..." />
      <StatusFilterSelect options={STATUS_OPTIONS} />
      <TableFilterSelect
        paramKey="customerId"
        placeholder="All customers"
        className="w-56"
        options={customerOptions.map((c) => ({ value: c.id, label: c.name }))}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dateFrom" className="text-xs text-muted-foreground">
          Order date from
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
          Order date to
        </Label>
        <Input
          id="dateTo"
          type="date"
          className="w-40"
          defaultValue={initial.dateTo}
          onChange={(e) => setParam("dateTo", e.target.value)}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push("?page=1")}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
