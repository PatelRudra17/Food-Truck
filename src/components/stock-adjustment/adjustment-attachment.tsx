"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdjustmentAttachmentUrlAction } from "@/lib/actions/stock-adjustment-actions";

export function AdjustmentAttachment({ id, fileName }: { id: string; fileName: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    const result = await getAdjustmentAttachmentUrlAction(id);
    setIsDownloading(false);
    if (result.ok) {
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{fileName}</span>
      </span>
      <Button variant="outline" size="sm" disabled={isDownloading} onClick={handleDownload}>
        <Download className="h-4 w-4" /> {isDownloading ? "..." : "Download"}
      </Button>
    </li>
  );
}
