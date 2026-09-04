"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileText, Eye, Pencil, Plus, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleDocumentDialog } from "@/components/vehicles/vehicle-document-dialog";
import {
  uploadVehicleDocumentFileAction,
  getVehicleDocumentDownloadUrlAction,
} from "@/lib/actions/vehicle-actions";

export type VehicleAttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByName: string;
};

export type VehicleDocumentRow = {
  id: string;
  docType: string;
  docNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  attachments: VehicleAttachmentRow[];
};

function AttachmentViewButton({ attachmentId }: { attachmentId: string }) {
  const [pending, startTransition] = useTransition();

  function handleView() {
    startTransition(async () => {
      const result = await getVehicleDocumentDownloadUrlAction(attachmentId);
      if (result.ok) {
        window.open(result.data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleView} disabled={pending}>
      <Eye className="h-4 w-4" /> {pending ? "Loading..." : "View"}
    </Button>
  );
}

function DocumentUploadForm({ vehicleDocumentId }: { vehicleDocumentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    formData.set("vehicleDocumentId", vehicleDocumentId);
    const result = await uploadVehicleDocumentFileAction(formData);
    if (result.ok) {
      toast.success("File uploaded.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <form action={(fd) => startTransition(() => handleSubmit(fd))} className="flex items-center gap-2">
      <Input type="file" name="file" required className="h-8 max-w-64 text-xs" accept=".pdf,.jpg,.jpeg,.png,.xlsx" />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Uploading..." : "Upload"}
      </Button>
    </form>
  );
}

export function VehicleDocumentSection({
  vehicleId,
  documents,
  canCreate,
  canEdit,
}: {
  vehicleId: string;
  documents: VehicleDocumentRow[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <VehicleDocumentDialog
            vehicleId={vehicleId}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Document
              </Button>
            }
          />
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="No documents on file" description="Add registration, insurance, PUC, fitness or permit records." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{doc.docType.replaceAll("_", " ")}</span>
                  <StatusBadge status={doc.verificationStatus} />
                </div>
                {canEdit && (
                  <VehicleDocumentDialog
                    vehicleId={vehicleId}
                    documentId={doc.id}
                    defaultValues={{
                      vehicleId,
                      docType: doc.docType as never,
                      docNumber: doc.docNumber ?? undefined,
                      issueDate: doc.issueDate ? doc.issueDate.slice(0, 10) : undefined,
                      expiryDate: doc.expiryDate ? doc.expiryDate.slice(0, 10) : undefined,
                      verificationStatus: doc.verificationStatus as never,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon-sm" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                  <span>Doc Number</span>
                  <span className="text-right text-foreground">{doc.docNumber ?? "—"}</span>
                  <span>Issue Date</span>
                  <span className="text-right text-foreground">
                    {doc.issueDate ? format(new Date(doc.issueDate), "dd MMM yyyy") : "—"}
                  </span>
                  <span>Expiry Date</span>
                  <span className="text-right text-foreground">
                    {doc.expiryDate ? format(new Date(doc.expiryDate), "dd MMM yyyy") : "—"}
                  </span>
                  <span>Status</span>
                  <span className="text-right">
                    <ExpiryBadge date={doc.expiryDate} />
                  </span>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" /> Attachments
                  </p>
                  {doc.attachments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No file uploaded yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {doc.attachments.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{a.fileName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(a.sizeBytes / 1024).toFixed(0)} KB · {a.uploadedByName} ·{" "}
                              {format(new Date(a.uploadedAt), "dd MMM yyyy")}
                            </p>
                          </div>
                          <AttachmentViewButton attachmentId={a.id} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && <DocumentUploadForm vehicleDocumentId={doc.id} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
