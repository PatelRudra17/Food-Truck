"use client";

import { useRef, useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { FileText, Upload, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  uploadOutwardAttachmentAction,
  getOutwardAttachmentUrlAction,
} from "@/lib/actions/stock-outward-actions";

export type AttachmentRow = {
  id: string;
  fileName: string;
  uploadedAt: string;
  uploadedByName: string;
  sizeBytes: number;
};

export function OutwardAttachments({
  outwardId,
  attachments,
  canUpload,
}: {
  outwardId: string;
  attachments: AttachmentRow[];
  canUpload: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isOpening, setIsOpening] = useState<string | null>(null);

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file to upload.");
      return;
    }
    const formData = new FormData();
    formData.set("outwardId", outwardId);
    formData.set("file", file);
    startUpload(async () => {
      const result = await uploadOutwardAttachmentAction(formData);
      if (result.ok) {
        toast.success("Attachment uploaded.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        toast.error(result.error);
      }
    });
  }

  async function handleView(attachmentId: string) {
    setIsOpening(attachmentId);
    const result = await getOutwardAttachmentUrlAction(attachmentId);
    setIsOpening(null);
    if (result.ok) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-3">
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No supporting documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(a.sizeBytes / 1024).toFixed(0)} KB · {a.uploadedByName} ·{" "}
                    {format(new Date(a.uploadedAt), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isOpening === a.id}
                onClick={() => handleView(a.id)}
              >
                <ExternalLink className="mr-1 h-4 w-4" /> View
              </Button>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="flex items-center gap-2 pt-2">
          <Input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx" />
          <Button type="button" onClick={handleUpload} disabled={isUploading}>
            <Upload className="mr-2 h-4 w-4" /> {isUploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      )}
    </div>
  );
}
