"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notification-actions";
import type { Notification } from "@prisma/client";

const POLL_MS = 30_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const count = await getUnreadNotificationCount();
      if (!cancelled) setUnread(count);
    };
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (open) {
      startTransition(async () => {
        const list = await getMyNotifications();
        setNotifications(list);
      });
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <Badge className="absolute -right-1 -top-1 h-4.5 min-w-4.5 justify-center rounded-full px-1 text-[10px]">
              {unread > 9 ? "9+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead();
                setUnread(0);
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
              })
            }
          >
            Mark all read
          </Button>
        </div>
        <ScrollArea className="h-80">
          {isPending && notifications.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Loading...</p>
          )}
          {!isPending && notifications.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
          )}
          <ul>
            {notifications.map((n) => (
              <li key={n.id} className="border-b last:border-0">
                <button
                  className={`w-full px-3 py-2.5 text-left text-sm hover:bg-muted ${!n.isRead ? "bg-primary/5" : ""}`}
                  onClick={() => {
                    if (!n.isRead) {
                      startTransition(async () => {
                        await markNotificationRead(n.id);
                        setUnread((c) => Math.max(0, c - 1));
                        setNotifications((prev) =>
                          prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
                        );
                      });
                    }
                  }}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(n.createdAt, { addSuffix: true })}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <div className="border-t p-2 text-center">
          <Link href="/notifications" className="text-xs text-primary hover:underline" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
