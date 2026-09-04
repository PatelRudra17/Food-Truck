"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileDown, CheckCircle2, XCircle } from "lucide-react";
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
import { bulkImportItemsAction, type BulkImportResult } from "@/lib/actions/item-import-actions";
import { ITEM_IMPORT_TEMPLATE_HEADERS } from "@/lib/validators/item";

function templateDataUrl() {
  const csv = ITEM_IMPORT_TEMPLATE_HEADERS.join(",") + "\r\n";
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export function BulkImportDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleImport() {
    if (!file) {
      toast.error("Choose a CSV file first.");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      const res = await bulkImportItemsAction(formData);
      if (res.ok) {
        setResult(res.data);
        if (res.data.failures.length === 0) {
          toast.success(`Imported ${res.data.successCount} item(s).`);
        } else {
          toast.warning(`Imported ${res.data.successCount} item(s), ${res.data.failures.length} failed.`);
        }
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      setFile(null);
      setResult(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload /> Bulk Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Import Items</DialogTitle>
          <DialogDescription>
            Upload a CSV of items. Each row is validated and inserted independently — a failing row never blocks the
            others.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <a
            href={templateDataUrl()}
            download="item-import-template.csv"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <FileDown className="h-4 w-4" /> Download CSV template
          </a>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              id="csv-file"
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {result && (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {result.successCount} row(s) imported successfully
              </p>
              {result.failures.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
                    <XCircle className="h-4 w-4" /> {result.failures.length} row(s) failed
                  </p>
                  <ul className="ml-5 list-disc space-y-0.5 text-muted-foreground">
                    {result.failures.map((f, idx) => (
                      <li key={idx}>
                        Row {f.row}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleImport} disabled={isPending || !file}>
            {isPending ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
