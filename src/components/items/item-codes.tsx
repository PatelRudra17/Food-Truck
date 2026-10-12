"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { toast } from "sonner";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateItemCodesAction } from "@/lib/actions/item-actions";

export function ItemCodes({
  itemId,
  qrCodePayload,
  barcode,
  canEdit,
}: {
  itemId: string;
  qrCodePayload: string | null;
  barcode: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  // The rendered QR image is remembered with the payload it was made from, so a stale or
  // missing payload simply derives "no image" during render instead of resetting state in an effect.
  const [qrImage, setQrImage] = useState<{ payload: string; dataUrl: string | null } | null>(null);
  const qrDataUrl = qrCodePayload && qrImage?.payload === qrCodePayload ? qrImage.dataUrl : null;
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!qrCodePayload) return;
    let cancelled = false;
    QRCode.toDataURL(qrCodePayload, { width: 160, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) setQrImage({ payload: qrCodePayload, dataUrl });
      })
      .catch(() => {
        if (!cancelled) setQrImage({ payload: qrCodePayload, dataUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [qrCodePayload]);

  useEffect(() => {
    if (barcode && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, barcode, {
          format: "EAN13",
          width: 1.6,
          height: 60,
          displayValue: true,
          fontSize: 12,
        });
      } catch {
        // Non-EAN13-shaped legacy barcode values still render as CODE128 fallback.
        try {
          JsBarcode(barcodeRef.current, barcode, { format: "CODE128", width: 1.6, height: 60, displayValue: true, fontSize: 12 });
        } catch {
          /* ignore render failure */
        }
      }
    }
  }, [barcode]);

  function handleGenerate() {
    startTransition(async () => {
      const result = await generateItemCodesAction(itemId);
      if (result.ok) {
        toast.success("Codes generated.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const needsGenerate = !qrCodePayload || !barcode;

  return (
    <div className="flex flex-wrap items-start gap-8">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">QR Code</p>
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Item QR code" width={140} height={140} className="rounded-md border p-1" />
        ) : (
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-md border border-dashed text-muted-foreground">
            <QrCode className="h-8 w-8" />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">Barcode</p>
        {barcode ? (
          <svg ref={barcodeRef} />
        ) : (
          <div className="flex h-[80px] w-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            No barcode yet
          </div>
        )}
      </div>

      {canEdit && needsGenerate && (
        <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending} className="self-center">
          {isPending ? "Generating..." : "Generate missing codes"}
        </Button>
      )}
    </div>
  );
}
