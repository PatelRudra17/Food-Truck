"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  vehicleDocumentSchema,
  VEHICLE_DOC_TYPES,
  VERIFICATION_STATUSES,
  type VehicleDocumentInput,
} from "@/lib/validators/vehicle";
import { upsertVehicleDocumentAction } from "@/lib/actions/vehicle-actions";

type VehicleDocumentFormInput = z.input<typeof vehicleDocumentSchema>;

export function VehicleDocumentDialog({
  vehicleId,
  documentId,
  defaultValues,
  trigger,
}: {
  vehicleId: string;
  documentId?: string;
  defaultValues?: Partial<VehicleDocumentInput>;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // Every field listed explicitly: reset() leaves out-of-list fields holding the previous document's text.
  const blank = {
    vehicleId,
    docType: "REGISTRATION" as const,
    docNumber: "",
    issueDate: "",
    expiryDate: "",
    verificationStatus: "UNVERIFIED" as const,
    ...defaultValues,
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleDocumentFormInput, unknown, VehicleDocumentInput>({
    resolver: zodResolver(vehicleDocumentSchema),
    defaultValues: blank,
  });

  const docType = watch("docType");
  const verificationStatus = watch("verificationStatus");

  async function onSubmit(values: VehicleDocumentInput) {
    const result = await upsertVehicleDocumentAction(values, documentId);
    if (result.ok) {
      toast.success(documentId ? "Document updated." : "Document added.");
      setOpen(false);
      // Closing via setOpen doesn't fire onOpenChange, so clear the form here
      // or the next "Add Document" starts with these values.
      reset(blank);
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
        if (!next) reset(blank);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{documentId ? "Edit Document" : "Add Document"}</DialogTitle>
          <DialogDescription>Vehicle registration / insurance / PUC / fitness / permit record.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="vehicle-docType">Document Type *</Label>
            <Select value={docType} onValueChange={(v) => setValue("docType", v as VehicleDocumentInput["docType"])}>
              <SelectTrigger id="vehicle-docType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="docNumber">Document Number</Label>
            <Input id="docNumber" {...register("docNumber")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input id="issueDate" type="date" {...register("issueDate")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input id="expiryDate" type="date" {...register("expiryDate")} />
              {errors.expiryDate && <p className="text-xs text-destructive">{errors.expiryDate.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="vehicle-verificationStatus">Verification Status</Label>
            <Select
              value={verificationStatus}
              onValueChange={(v) => setValue("verificationStatus", v as VehicleDocumentInput["verificationStatus"])}
            >
              <SelectTrigger id="vehicle-verificationStatus" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERIFICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {errors.root && <p className="text-xs text-destructive">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : documentId ? "Save Changes" : "Add Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
