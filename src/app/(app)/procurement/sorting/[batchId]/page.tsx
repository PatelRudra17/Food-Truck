import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { SortingForm } from "@/components/sorting/sorting-form";

export const metadata = { title: "Sort Batch" };

export default async function SortBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  await requirePermission("SORTING_CREATE");
  const { batchId } = await params;

  const batch = await prisma.procurementBatch.findUnique({
    where: { id: batchId },
    include: {
      item: { select: { name: true } },
      supplier: { select: { companyName: true } },
      warehouse: { select: { name: true } },
      sorting: { select: { id: true } },
    },
  });

  if (!batch) notFound();

  if (batch.status !== "PENDING_SORTING" || batch.sorting) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sort Batch" description={`Batch ${batch.batchNumber}`} />
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          This batch is {batch.sorting ? "already sorted" : "not pending sorting"}.
        </div>
        <Button asChild variant="outline">
          <Link href="/procurement/sorting">Back to Sorting</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sort Batch"
        description={`Grade batch ${batch.batchNumber} into Grade A/B/C/Other and record any wastage.`}
      />
      <SortingForm
        batch={{
          id: batch.id,
          batchNumber: batch.batchNumber,
          itemName: batch.item.name,
          supplierName: batch.supplier.companyName,
          warehouseName: batch.warehouse.name,
          rawWeight: Number(batch.rawWeight),
        }}
      />
    </div>
  );
}
