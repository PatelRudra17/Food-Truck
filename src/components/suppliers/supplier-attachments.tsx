"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  uploadSupplierAttachmentAction,
  getSupplierAttachmentUrlAction,
} from "@/lib/actions/supplier-actions";

export type SupplierAttachmentRow = {
  id: string;
  fileName: string;
  documentType: string | null;
  sizeBytes: number;
  uploadedAt: string;
  uploadedByName: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupplierAttachments({
  supplierId,
  attachments,
  canUpload,
}: {
  supplierId: string;
  attachments: SupplierAttachmentRow[];
  canUpload: boolean;
}) {
  const [documentType, setDocumentType] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please choose a file to upload.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    formData.set("documentType", documentType);

    startTransition(async () => {
      const result = await uploadSupplierAttachmentAction(supplierId, formData);
      if (result.ok) {
        toast.success("Document uploaded.");
        setDocumentType("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleDownload(attachmentId: string) {
    setIsDownloading(attachmentId);
    const result = await getSupplierAttachmentUrlAction(attachmentId);
    setIsDownloading(null);
    if (result.ok) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Document type</label>
            <Input
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              placeholder="e.g. Contract, Certification"
              className="w-52"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">File</label>
            <Input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx" className="w-64" />
          </div>
          <Button type="submit" size="sm" disabled={isPending}>
            <Upload className="h-4 w-4" /> {isPending ? "Uploading..." : "Upload"}
          </Button>
        </form>
      )}

      {attachments.length === 0 ? (
        <EmptyState icon={FileText} title="No documents uploaded yet" />
      ) : (
        <ul className="divide-y rounded-md border">
          {attachments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{doc.fileName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {doc.documentType ?? "Document"} • {formatBytes(doc.sizeBytes)} • uploaded by{" "}
                    {doc.uploadedByName} on {doc.uploadedAt}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isDownloading === doc.id}
                onClick={() => handleDownload(doc.id)}
              >
                <Download className="h-4 w-4" /> {isDownloading === doc.id ? "..." : "Download"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
