import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SystemSettingsForm } from "@/components/settings/system-settings-form";
import { SETTING_KEYS } from "@/lib/validators/settings";

export const metadata = { title: "System Settings" };

function valueOf<T>(map: Map<string, unknown>, key: string, fallback: T): T {
  const value = map.get(key);
  return (value as T | undefined) ?? fallback;
}

export default async function SettingsPage() {
  await requirePermission("MANAGE_SETTINGS");

  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
    orderBy: { key: "asc" },
  });

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Manage company-level defaults, inventory control behavior, and audit-facing configuration."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/settings/users">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>Manage application users and role assignment.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/settings/roles">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Roles & Permissions</CardTitle>
              <CardDescription>Review role access and permission coverage.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/settings/audit-log">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Audit Log</CardTitle>
              <CardDescription>Inspect security-sensitive activity and admin changes.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/settings/approvals">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Approval Center</CardTitle>
              <CardDescription>Review and act on pending approvals across every workflow.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <SystemSettingsForm
        initialValues={{
          companyName: valueOf(map, SETTING_KEYS.COMPANY_NAME, "Enterprise Inventory & Logistics"),
          currency: valueOf(map, SETTING_KEYS.CURRENCY, "INR"),
          dateFormat: valueOf(map, SETTING_KEYS.DATE_FORMAT, "DD/MM/YYYY"),
          timeZone: valueOf(map, SETTING_KEYS.TIME_ZONE, "Asia/Calcutta"),
          allowNegativeStock: valueOf(map, SETTING_KEYS.ALLOW_NEGATIVE_STOCK, false),
          documentExpiryWarningDays: valueOf(map, SETTING_KEYS.DOCUMENT_EXPIRY_WARNING_DAYS, [7, 15, 30]),
          highWastageThresholdPercent: valueOf(map, SETTING_KEYS.HIGH_WASTAGE_THRESHOLD_PERCENT, 15),
          crateOverdueThresholdDays: valueOf(map, SETTING_KEYS.CRATE_OVERDUE_THRESHOLD_DAYS, 14),
          requireSeparateApprover: valueOf<unknown>(map, SETTING_KEYS.REQUIRE_SEPARATE_APPROVER, false) === true,
        }}
        companyLogoStorageKey={valueOf<string | null>(map, SETTING_KEYS.COMPANY_LOGO_STORAGE_KEY, null)}
      />
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          Settings are persisted in the `SystemSetting` table and audited on every change.
        </CardContent>
      </Card>
    </div>
  );
}
