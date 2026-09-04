import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { ChecklistTable, type ChecklistItemRow } from "@/components/next-day-prep/checklist-table";
import { PrepRemarksEditor } from "@/components/next-day-prep/prep-remarks-editor";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Preparation Checklist" };

export default async function NextDayPreparationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("OPERATIONS_VIEW");
  const canEdit = hasPermission(user, "OPERATIONS_EDIT");
  const { id } = await params;

  const prep = await prisma.nextDayPreparation.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      checklistItems: {
        include: { assignedTo: { select: { name: true } } },
        orderBy: { label: "asc" },
      },
    },
  });

  if (!prep) notFound();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const userOptions = users.map((u) => ({ id: u.id, label: u.name }));

  const checklistRows: ChecklistItemRow[] = prep.checklistItems.map((i) => ({
    id: i.id,
    label: i.label,
    status: i.status,
    assignedToId: i.assignedToId,
    assignedToName: i.assignedTo?.name ?? null,
    remark: i.remark,
  }));

  const completeCount = checklistRows.filter((r) => r.status === "COMPLETE").length;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/operations/next-day">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to preparations
          </Link>
        </Button>
        <PageHeader
          title={`Preparation — ${format(prep.date, "dd MMM yyyy")}`}
          description={`Created by ${prep.createdBy.name} · ${completeCount}/${checklistRows.length} items complete`}
        />
      </div>

      <PrepRemarksEditor preparationId={prep.id} initialRemarks={prep.remarks ?? ""} canEdit={canEdit} />

      <ChecklistTable rows={checklistRows} canEdit={canEdit} userOptions={userOptions} />
    </div>
  );
}
