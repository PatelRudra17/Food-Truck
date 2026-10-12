import { requirePermission } from "@/lib/auth/guard";
import { getProcurementFormOptions } from "@/lib/services/procurement";
import { PageHeader } from "@/components/shared/page-header";
import { ProcurementForm } from "@/components/procurement/procurement-form";

export const metadata = { title: "New Procurement" };

export default async function NewProcurementPage() {
  await requirePermission("PROCUREMENT_CREATE");

  const options = await getProcurementFormOptions();

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Procurement"
        description="Record produce received from a supplier as one or more line items."
      />
      <ProcurementForm {...options} />
    </div>
  );
}
