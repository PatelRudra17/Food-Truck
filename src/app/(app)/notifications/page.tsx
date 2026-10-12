import { NotificationType } from "@prisma/client";
import { requireUser } from "@/lib/auth/guard";
import { getUnreadNotificationCount, getMyNotificationsPaginated } from "@/lib/actions/notification-actions";
import { PageHeader } from "@/components/shared/page-header";
import { TableFilterSelect } from "@/components/shared/table-filter-select";
import { paginationMeta } from "@/lib/validators/common";
import { NotificationsClient } from "@/components/notifications/notifications-client";
import { notificationHref } from "@/lib/notification-href";

export const metadata = { title: "Notifications" };

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

  const filters = {
    pageSize,
    isRead: readFilter === "read" ? true : readFilter === "unread" ? false : undefined,
    type: type && type in NotificationType ? (type as NotificationType) : undefined,
  };

  const [firstFetch, unreadCount] = await Promise.all([
    getMyNotificationsPaginated({ ...filters, page }),
    getUnreadNotificationCount(),
  ]);

  // A page past the end (e.g. ?page=999) would render "Showing 19961–1 of 1".
  // Clamp to the last page that actually has rows and refetch it.
  const lastPage = Math.max(1, Math.ceil(firstFetch.total / firstFetch.pageSize));
  const notifications =
    firstFetch.page > lastPage
      ? await getMyNotificationsPaginated({ ...filters, page: lastPage })
      : firstFetch;

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
