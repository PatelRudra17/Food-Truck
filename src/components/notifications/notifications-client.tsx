"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { LegacyColumnDef as ColumnDef } from "@tanstack/react-table/legacy";
import { BellRing, CheckCheck } from "lucide-react";
import { DataTable, type PaginationMeta } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notification-actions";

export type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  href: string | null;
};

export function NotificationsClient({
  rows,
  pagination,
  unreadCount,
}: {
  rows: NotificationRow[];
  pagination: PaginationMeta;
  unreadCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const columns = useMemo<ColumnDef<NotificationRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Notification",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.original.title}</span>
              {!row.original.isRead && (
                <Badge variant="outline" className="border-transparent bg-primary/10 text-primary">
                  Unread
                </Badge>
              )}
            </div>
            <p className="max-w-xl text-xs text-muted-foreground">{row.original.message}</p>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => row.original.type.replaceAll("_", " "),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => format(new Date(row.original.createdAt), "dd MMM yyyy, HH:mm"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {row.original.href && (
              <Button asChild variant="outline" size="sm">
                <Link href={row.original.href}>Open</Link>
              </Button>
            )}
            {!row.original.isRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  startTransition(async () => {
                    await markNotificationRead(row.original.id);
                    router.refresh();
                  })
                }
              >
                Mark read
              </Button>
            )}
          </div>
        ),
      },
    ],
    [router, startTransition],
  );

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead();
                router.refresh();
              })
            }
            disabled={isPending}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        pagination={pagination}
        emptyTitle="No notifications found."
        emptyDescription="You're all caught up for the selected filters."
      />
      {rows.length === 0 && unreadCount === 0 && (
        <div className="hidden">
          <BellRing className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
