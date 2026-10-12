"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCrateReturnSchema, type CreateCrateReturnInput } from "@/lib/validators/crate-return";
import { createCrateReturnAction } from "@/lib/actions/crate-return-actions";

export type TripOption = {
  id: string;
  tripNumber: string;
  customerId: string;
  customerName: string;
  suggestedCratesDispatched: number;
  /** Returned + damaged + missing across returns already recorded for this trip. */
  alreadyAccounted: number;
};
export type CrateOption = { id: string; crateCode: string; customerId: string | null; status: string };

type FormInput = z.input<typeof createCrateReturnSchema>;

type CrateOutcomeValue = "NONE" | "RETURNED" | "DAMAGED" | "MISSING";

export function CrateReturnFormDialog({ trips, crates }: { trips: TripOption[]; crates: CrateOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tripId, setTripId] = useState<string>("");
  const [outcomes, setOutcomes] = useState<Record<string, CrateOutcomeValue>>({});

  const selectedTrip = trips.find((t) => t.id === tripId);
  const candidateCrates = useMemo(
    () => (selectedTrip ? crates.filter((c) => c.customerId === selectedTrip.customerId) : []),
    [crates, selectedTrip],
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, CreateCrateReturnInput>({
    resolver: zodResolver(createCrateReturnSchema),
    defaultValues: {
      tripId: "",
      cratesDispatched: 0,
      cratesReturned: 0,
      cratesDamaged: 0,
      cratesMissing: 0,
      returnDate: format(new Date(), "yyyy-MM-dd"),
      condition: "",
      remarks: "",
      crateOutcomes: [],
    },
  });

  function handleTripChange(value: string) {
    setTripId(value);
    setOutcomes({});
    setValue("tripId", value);
    const trip = trips.find((t) => t.id === value);
    setValue("cratesDispatched", trip?.suggestedCratesDispatched ?? 0);
  }

  function setOutcome(crateId: string, outcome: CrateOutcomeValue) {
    setOutcomes((prev) => {
      const next = { ...prev };
      if (outcome === "NONE") delete next[crateId];
      else next[crateId] = outcome;
      return next;
    });
  }

  async function onSubmit(values: CreateCrateReturnInput) {
    const crateOutcomes = Object.entries(outcomes).map(([crateId, outcome]) => ({
      crateId,
      outcome: outcome as "RETURNED" | "DAMAGED" | "MISSING",
    }));
    const result = await createCrateReturnAction({ ...values, crateOutcomes });
    if (result.ok) {
      toast.success("Crate return recorded.");
      setOpen(false);
      reset();
      setOutcomes({});
      setTripId("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          setOutcomes({});
          setTripId("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New Crate Return
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Crate Return</DialogTitle>
          <DialogDescription>
            Select the trip a vehicle returned from and record how many crates came back, were damaged, or are
            missing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>Trip *</FieldLabel>
              <Select value={tripId} onValueChange={handleTripChange}>
                <SelectTrigger className="w-full" aria-invalid={!!errors.tripId}>
                  <SelectValue placeholder="Select a dispatched trip" />
                </SelectTrigger>
                <SelectContent>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.tripNumber} — {t.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[errors.tripId]} />
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="cratesDispatched">Dispatched *</FieldLabel>
                <Input
                  id="cratesDispatched"
                  type="number"
                  min="0"
                  step="1"
                  readOnly={!!selectedTrip && selectedTrip.suggestedCratesDispatched > 0}
                  {...register("cratesDispatched")}
                />
                <FieldError errors={[errors.cratesDispatched]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="cratesReturned">Returned</FieldLabel>
                <Input
                  id="cratesReturned"
                  type="number"
                  min="0"
                  step="1"
                  disabled={Object.keys(outcomes).length > 0}
                  {...register("cratesReturned")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cratesDamaged">Damaged</FieldLabel>
                <Input
                  id="cratesDamaged"
                  type="number"
                  min="0"
                  step="1"
                  disabled={Object.keys(outcomes).length > 0}
                  {...register("cratesDamaged")}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cratesMissing">Missing</FieldLabel>
                <Input
                  id="cratesMissing"
                  type="number"
                  min="0"
                  step="1"
                  disabled={Object.keys(outcomes).length > 0}
                  {...register("cratesMissing")}
                />
              </Field>
            </div>
            <FieldError errors={[errors.cratesReturned]} />
            {selectedTrip && selectedTrip.alreadyAccounted > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedTrip.alreadyAccounted} crate(s) on this trip are already accounted for by earlier returns.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="returnDate">Return Date</FieldLabel>
                <Input id="returnDate" type="date" {...register("returnDate")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="condition">Overall Condition</FieldLabel>
                <Input id="condition" placeholder="e.g. Good, minor wear" {...register("condition")} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
              <Textarea id="remarks" rows={2} {...register("remarks")} />
            </Field>
          </FieldGroup>

          {selectedTrip && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Update specific crates for {selectedTrip.customerName} (optional)
              </p>
              {candidateCrates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No individually tracked crates are currently assigned to this customer — only the aggregate counts
                  above will be recorded.
                </p>
              ) : (
                <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-md border p-2">
                  {candidateCrates.map((crate) => (
                    <div key={crate.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>{crate.crateCode}</span>
                      <Select
                        value={outcomes[crate.id] ?? "NONE"}
                        onValueChange={(v) => setOutcome(crate.id, v as CrateOutcomeValue)}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">No change</SelectItem>
                          <SelectItem value="RETURNED">Returned</SelectItem>
                          <SelectItem value="DAMAGED">Damaged</SelectItem>
                          <SelectItem value="MISSING">Missing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !tripId}>
              {isSubmitting ? "Saving..." : "Record Return"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
