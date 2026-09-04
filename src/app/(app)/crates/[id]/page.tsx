import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, RefreshCcw, History } from "lucide-react";
import { format } from "date-fns";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { CrateFormDialog } from "@/components/crates/crate-form-dialog";
import { CrateStatusDialog } from "@/components/crates/crate-status-dialog";

export const metadata = { title: "Crate Detail" };

export default async function CrateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("CRATE_VIEW");
  const { id } = await params;
  const user = await getSessionUser();

  const crate = await prisma.crate.findUnique({
    where: { id },
    include: { customer: { select: { id: true, name: true, customerCode: true } } },
  });
  if (!crate) notFound();

  const [history, customers] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "Crate", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, customerCode: true },
    }),
  ]);

  const canEdit = hasPermission(user, "CRATE_EDIT");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/crates" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to crates
        </Link>
        <PageHeader
          title={`${crate.crateCode} — ${crate.crateType}`}
          description={crate.currentLocation ?? undefined}
          actions={
            <>
              <StatusBadge status={crate.status} />
              {canEdit && (
                <>
                  <CrateFormDialog
                    customers={customers}
                    editing={{
                      id: crate.id,
                      crateCode: crate.crateCode,
                      crateType: crate.crateType,
                      capacity: crate.capacity,
                      currentLocation: crate.currentLocation,
                      customerId: crate.customerId,
                      condition: crate.condition,
                    }}
                    trigger={
                      <Button size="sm" variant="outline">
                        <Pencil /> Edit
                      </Button>
                    }
                  />
                  <CrateStatusDialog
                    crateId={crate.id}
                    crateCode={crate.crateCode}
                    currentStatus={crate.status}
                    trigger={
                      <Button size="sm">
                        <RefreshCcw /> Change status
                      </Button>
                    }
                  />
                </>
              )}
            </>
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Capacity</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium">{crate.capacity ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Condition</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium">{crate.condition ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Current Location</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium">{crate.currentLocation ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Customer</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-medium">
            {crate.customer ? `${crate.customer.name} (${crate.customer.customerCode})` : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status &amp; Change History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState icon={History} title="No history yet" description="Status changes and edits will appear here." />
          ) : (
            <ul className="space-y-3">
              {history.map((entry) => {
                const newValues = entry.newValues as Record<string, unknown> | null;
                const reason = newValues && typeof newValues.reason === "string" ? newValues.reason : null;
                const newStatus = newValues && typeof newValues.status === "string" ? newValues.status : null;
                return (
                  <li key={entry.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{entry.action}</span>
                      {newStatus && <StatusBadge status={newStatus} />}
                      <span className="text-muted-foreground">
                        by {entry.user?.name ?? "System"} on {format(entry.createdAt, "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    {reason && <p className="text-sm text-muted-foreground">Reason: {reason}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
