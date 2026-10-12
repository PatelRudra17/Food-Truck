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
  driverDocumentSchema,
  DRIVER_DOC_TYPES,
  VERIFICATION_STATUSES,
  isSensitiveDocType,
  type DriverDocumentInput,
} from "@/lib/validators/driver";
import { upsertDriverDocumentAction } from "@/lib/actions/driver-actions";

type DriverDocumentFormInput = z.input<typeof driverDocumentSchema>;

export function DriverDocumentDialog({
  driverId,
  documentId,
  defaultValues,
  trigger,
}: {
  driverId: string;
  documentId?: string;
  defaultValues?: Partial<DriverDocumentInput>;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // Every field listed explicitly: reset() leaves out-of-list fields holding the previous document's text.
  const blank = {
    driverId,
    docType: "AADHAAR" as const,
    plainNumber: "",
    licenceClass: "",
    issueDate: "",
    expiryDate: "",
    issuingAuthority: "",
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
  } = useForm<DriverDocumentFormInput, unknown, DriverDocumentInput>({
    resolver: zodResolver(driverDocumentSchema),
    defaultValues: blank,
  });

  const docType = watch("docType");
  const verificationStatus = watch("verificationStatus");
  const sensitive = isSensitiveDocType(docType);

  async function onSubmit(values: DriverDocumentInput) {
    const result = await upsertDriverDocumentAction(values, documentId);
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
        if (!next) {
          reset(blank);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{documentId ? "Edit Driver Document" : "Add Driver Document"}</DialogTitle>
          <DialogDescription>
            Sensitive identity numbers are stored encrypted and only revealed to authorized users.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="driver-docType">Document Type *</Label>
            <Select value={docType} onValueChange={(v) => setValue("docType", v as DriverDocumentInput["docType"])}>
              <SelectTrigger id="driver-docType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DRIVER_DOC_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="plainNumber">{sensitive ? "Identity Number *" : "Document Number"}</Label>
            <Input
              id="plainNumber"
              placeholder={sensitive ? "Stored encrypted on save" : "Optional document number"}
              {...register("plainNumber")}
            />
            {errors.plainNumber && <p className="text-xs text-destructive">{errors.plainNumber.message}</p>}
          </div>

          {docType === "DRIVING_LICENCE" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="licenceClass">Licence Class</Label>
                <Input id="licenceClass" {...register("licenceClass")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="issuingAuthority">Issuing Authority</Label>
                <Input id="issuingAuthority" {...register("issuingAuthority")} />
              </div>
            </div>
          )}

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
            <Label htmlFor="driver-verificationStatus">Verification Status</Label>
            <Select
              value={verificationStatus}
              onValueChange={(v) =>
                setValue("verificationStatus", v as DriverDocumentInput["verificationStatus"])
              }
            >
              <SelectTrigger id="driver-verificationStatus" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERIFICATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
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
