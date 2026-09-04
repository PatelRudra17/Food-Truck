"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Eye, FileText, Paperclip, Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { DriverDocumentDialog } from "@/components/drivers/driver-document-dialog";
import {
  getDriverDocumentDownloadUrlAction,
  revealDriverDocumentNumber,
  uploadDriverDocumentFileAction,
} from "@/lib/actions/driver-actions";

export type DriverAttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByName: string;
};

export type DriverDocumentRow = {
  id: string;
  docType: string;
  numberMasked: string | null;
  licenceClass: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  verificationStatus: string;
  isSensitive: boolean;
  attachments: DriverAttachmentRow[];
};

function AttachmentViewButton({ attachmentId }: { attachmentId: string }) {
  const [pending, startTransition] = useTransition();

  function handleView() {
    startTransition(async () => {
      const result = await getDriverDocumentDownloadUrlAction(attachmentId);
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

function DocumentNumber({
  documentId,
  masked,
  isSensitive,
  canReveal,
}: {
  documentId: string;
  masked: string | null;
  isSensitive: boolean;
  canReveal: boolean;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isSensitive) {
    return <span>{masked ?? "—"}</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-mono">{revealed ?? masked ?? "—"}</span>
      {canReveal && !revealed && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() =>
            startTransition(async () => {
              const result = await revealDriverDocumentNumber(documentId);
              if (result.ok) {
                setRevealed(result.data.value);
              } else {
                toast.error(result.error);
              }
            })
          }
          disabled={pending}
        >
          {pending ? "Loading..." : "Reveal"}
        </Button>
      )}
    </div>
  );
}

function DocumentUploadForm({ driverDocumentId }: { driverDocumentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    formData.set("driverDocumentId", driverDocumentId);
    const result = await uploadDriverDocumentFileAction(formData);
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

export function DriverDocumentSection({
  driverId,
  documents,
  canCreate,
  canEdit,
  canRevealSensitive,
}: {
  driverId: string;
  documents: DriverDocumentRow[];
  canCreate: boolean;
  canEdit: boolean;
  canRevealSensitive: boolean;
}) {
  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <DriverDocumentDialog
            driverId={driverId}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add Document
              </Button>
            }
          />
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No driver documents on file"
          description="Add Aadhaar, PAN, licence, medical or verification records."
        />
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
                  <DriverDocumentDialog
                    driverId={driverId}
                    documentId={doc.id}
                    defaultValues={{
                      driverId,
                      docType: doc.docType as DriverDocumentRow["docType"] & never,
                      issueDate: doc.issueDate ? doc.issueDate.slice(0, 10) : undefined,
                      expiryDate: doc.expiryDate ? doc.expiryDate.slice(0, 10) : undefined,
                      licenceClass: doc.licenceClass ?? undefined,
                      issuingAuthority: doc.issuingAuthority ?? undefined,
                      verificationStatus: doc.verificationStatus as DriverDocumentRow["verificationStatus"] & never,
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
                  <span>Document Number</span>
                  <span className="text-right text-foreground">
                    <DocumentNumber
                      documentId={doc.id}
                      masked={doc.numberMasked}
                      isSensitive={doc.isSensitive}
                      canReveal={canRevealSensitive}
                    />
                  </span>
                  <span>Issue Date</span>
                  <span className="text-right text-foreground">
                    {doc.issueDate ? format(new Date(doc.issueDate), "dd MMM yyyy") : "—"}
                  </span>
                  <span>Expiry Date</span>
                  <span className="text-right text-foreground">
                    {doc.expiryDate ? format(new Date(doc.expiryDate), "dd MMM yyyy") : "—"}
                  </span>
                  <span>Expiry Status</span>
                  <span className="text-right">
                    <ExpiryBadge date={doc.expiryDate} />
                  </span>
                  {doc.licenceClass && (
                    <>
                      <span>Licence Class</span>
                      <span className="text-right text-foreground">{doc.licenceClass}</span>
                    </>
                  )}
                  {doc.issuingAuthority && (
                    <>
                      <span>Issuing Authority</span>
                      <span className="text-right text-foreground">{doc.issuingAuthority}</span>
                    </>
                  )}
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
                      {doc.attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{attachment.fileName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {(attachment.sizeBytes / 1024).toFixed(0)} KB · {attachment.uploadedByName} ·{" "}
                              {format(new Date(attachment.uploadedAt), "dd MMM yyyy")}
                            </p>
                          </div>
                          <AttachmentViewButton attachmentId={attachment.id} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEdit && <DocumentUploadForm driverDocumentId={doc.id} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
