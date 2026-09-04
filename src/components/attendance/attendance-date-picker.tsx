"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/** URL-param-bound date picker for the attendance grid ("date" param, defaults handled by the page). */
export function AttendanceDatePicker({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("date", value);
    } else {
      params.delete("date");
    }
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-1">
      <Label htmlFor="attendance-date">Date</Label>
      <Input
        id="attendance-date"
        type="date"
        defaultValue={defaultValue}
        max={format(new Date(), "yyyy-MM-dd")}
        className="h-9 w-[160px]"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
