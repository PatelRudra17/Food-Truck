"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createHandoverAction } from "@/lib/actions/shift-handover-actions";
import { shiftHandoverSchema, type ShiftHandoverInput } from "@/lib/validators/shift-handover";

type ShiftOption = { id: string; label: string };
type UserOption = { id: string; label: string };
type HandoverFormInput = z.input<typeof shiftHandoverSchema>;

export function HandoverForm({
  shiftOptions,
  userOptions,
  defaultShiftId,
}: {
  shiftOptions: ShiftOption[];
  userOptions: UserOption[];
  defaultShiftId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HandoverFormInput, unknown, ShiftHandoverInput>({
    resolver: zodResolver(shiftHandoverSchema),
    defaultValues: {
      shiftId: defaultShiftId,
      previousSupervisorId: "",
      newSupervisorId: "",
      stockIssuesNote: "",
      cleaningStatusNote: "",
      crateStatusNote: "",
      remarks: "",
    },
  });

  async function onSubmit(values: ShiftHandoverInput) {
    setServerError(null);
    const result = await createHandoverAction(values);
    if (result.ok) {
      toast.success("Handover recorded.");
      reset({ ...values, previousSupervisorId: "", newSupervisorId: "", stockIssuesNote: "", cleaningStatusNote: "", crateStatusNote: "", remarks: "" });
      router.refresh();
    } else {
      setServerError(result.error);
      toast.error(result.error);
    }
  }

  function handleShiftChange(shiftId: string, onChange: (v: string) => void) {
    onChange(shiftId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("shiftId", shiftId);
    router.push(`?${params.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Record a shift handover</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="handover-shift">Shift</Label>
            <Controller
              control={control}
              name="shiftId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => handleShiftChange(v, field.onChange)}>
                  <SelectTrigger id="handover-shift" className="w-full">
                    <SelectValue placeholder="Select shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {shiftOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.shiftId && <p className="text-sm text-destructive">{errors.shiftId.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="previousSupervisorId">Previous supervisor</Label>
              <Controller
                control={control}
                name="previousSupervisorId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="previousSupervisorId" className="w-full">
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {userOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newSupervisorId">New supervisor</Label>
              <Controller
                control={control}
                name="newSupervisorId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="newSupervisorId" className="w-full">
                      <SelectValue placeholder="Not specified" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {userOptions.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stockIssuesNote">Stock issues</Label>
            <Textarea id="stockIssuesNote" rows={2} placeholder="Any stock discrepancies or issues to flag..." {...register("stockIssuesNote")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cleaningStatusNote">Cleaning status</Label>
            <Textarea id="cleaningStatusNote" rows={2} placeholder="What's clean, what's pending..." {...register("cleaningStatusNote")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="crateStatusNote">Crate status</Label>
            <Textarea id="crateStatusNote" rows={2} placeholder="Crates to note for the incoming shift..." {...register("crateStatusNote")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" rows={2} {...register("remarks")} />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !defaultShiftId}>
              {isSubmitting ? "Recording..." : "Record handover"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
