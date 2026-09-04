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

/** URL-param-bound filter dropdown for list pages ("all" clears the param and resets to page 1). */
export function TableFilterSelect({
  paramKey,
  placeholder,
  options,
  className,
}: {
  paramKey: string;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const value = searchParams.get(paramKey) ?? "all";

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, next);
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-[170px]"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
