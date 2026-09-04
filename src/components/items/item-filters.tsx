"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ItemFilters({
  categories,
  warehouses,
}: {
  categories: { id: string; name: string }[];
  warehouses: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  const sortValue = `${searchParams.get("sortBy") || "name"}:${searchParams.get("sortDir") || "asc"}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("categoryId") || "all"} onValueChange={(v) => setParam("categoryId", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("warehouseId") || "all"} onValueChange={(v) => setParam("warehouseId", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All warehouses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All warehouses</SelectItem>
          {warehouses.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.code} — {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get("status") || "active"} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={sortValue}
        onValueChange={(v) => {
          const [sortBy, sortDir] = v.split(":");
          const params = new URLSearchParams(searchParams.toString());
          params.set("sortBy", sortBy);
          params.set("sortDir", sortDir);
          params.set("page", "1");
          startTransition(() => router.push(`?${params.toString()}`));
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name:asc">Name (A–Z)</SelectItem>
          <SelectItem value="name:desc">Name (Z–A)</SelectItem>
          <SelectItem value="currentStock:asc">Stock (low to high)</SelectItem>
          <SelectItem value="currentStock:desc">Stock (high to low)</SelectItem>
          <SelectItem value="reorderLevel:asc">Reorder level (low to high)</SelectItem>
          <SelectItem value="reorderLevel:desc">Reorder level (high to low)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
