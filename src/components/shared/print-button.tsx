"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Print-friendly page action: renders the page as-is via the browser print dialog. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      <Printer className="mr-2 h-4 w-4" />
      Print
    </Button>
  );
}
