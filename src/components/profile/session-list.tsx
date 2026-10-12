"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { revokeSessionAction, revokeOtherSessionsAction } from "@/lib/actions/profile-actions";

export type SessionRow = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  isCurrent: boolean;
};

export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.userAgent ?? "Unknown device"}</p>
              <p className="text-xs text-muted-foreground">
                {s.ipAddress ?? "Unknown IP"} · signed in {format(new Date(s.createdAt), "dd MMM yyyy, HH:mm")}
              </p>
            </div>
            {s.isCurrent ? (
              <Badge variant="secondary">This device</Badge>
            ) : (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="outline">
                    Sign out
                  </Button>
                }
                title="Sign out this session?"
                description="That device will need to sign in again."
                confirmLabel="Sign out"
                onConfirm={() => revokeSessionAction(s.id)}
                onSuccess={refresh}
              />
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 && (
        <ConfirmDialog
          trigger={<Button variant="outline">Sign out all other sessions</Button>}
          title="Sign out all other sessions?"
          description={`${others.length} other session(s) will need to sign in again.`}
          confirmLabel="Sign out others"
          onConfirm={() => revokeOtherSessionsAction()}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
