import { NotificationType } from "@prisma/client";
import { requireUser } from "@/lib/auth/guard";
import { getUnreadNotificationCount, getMyNotificationsPaginated } from "@/lib/actions/notification-actions";
import { PageHeader } from "@/components/shared/page-header";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { paginationMeta } from "@/lib/validators/common";
import { NotificationsClient } from "@/components/notifications/notifications-client";

export const metadata = { title: "Notifications" };

function notificationHref(entityType: string | null, entityId: string | null) {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "StockInward":
      return `/stock/inward/${entityId}`;
    case "StockOutward":
      return `/stock/outward/${entityId}`;
    case "StockTransfer":
      return `/stock/transfer/${entityId}`;
    case "StockAdjustment":
      return `/stock/adjustment/${entityId}`;
    case "PurchaseOrder":
      return `/purchase-orders/${entityId}`;
    case "Vehicle":
      return `/vehicles/${entityId}`;
    case "Driver":
      return `/drivers/${entityId}`;
    case "Supplier":
      return `/suppliers/${entityId}`;
    case "Item":
      return `/items/${entityId}`;
    default:
      return null;
  }
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  const sp = await searchParams;

  const get = (key: string) => {
    const value = sp[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = Math.max(1, Number(get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(get("pageSize")) || 20));
  const readFilter = get("read");
  const type = get("type");

  const [notifications, unreadCount] = await Promise.all([
    getMyNotificationsPaginated({
      page,
      pageSize,
      isRead: readFilter === "read" ? true : readFilter === "unread" ? false : undefined,
      type: type && type in NotificationType ? (type as NotificationType) : undefined,
    }),
    getUnreadNotificationCount(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Review approvals, stock alerts, document expiry reminders, and system events."
      />

      <div className="flex flex-wrap items-center gap-2">
        <TableFilterSelect
          paramKey="read"
          placeholder="All statuses"
          options={[
            { value: "unread", label: "Unread" },
            { value: "read", label: "Read" },
          ]}
        />
        <TableFilterSelect
          paramKey="type"
          placeholder="All notification types"
          options={Object.values(NotificationType).map((value) => ({
            value,
            label: value.replaceAll("_", " "),
          }))}
        />
      </div>

      <NotificationsClient
        rows={notifications.rows.map((row) => ({
          id: row.id,
          title: row.title,
          message: row.message,
          type: row.type,
          isRead: row.isRead,
          createdAt: row.createdAt.toISOString(),
          href: notificationHref(row.entityType, row.entityId),
        }))}
        pagination={paginationMeta(notifications.total, { page: notifications.page, pageSize: notifications.pageSize })}
        unreadCount={unreadCount}
      />
    </div>
  );
}
