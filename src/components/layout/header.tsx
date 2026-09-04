import { MobileNav } from "@/components/layout/mobile-nav";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionUser } from "@/lib/auth/session";

export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 overflow-hidden border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:gap-3 sm:px-4">
      <div className="relative z-40 shrink-0">
        <MobileNav permissions={user.permissions} />
      </div>
      <div className="hidden min-w-0 lg:block">
        <Breadcrumbs />
      </div>
      <div className="ml-auto flex min-w-0 shrink items-center gap-1 sm:gap-2">
        <GlobalSearch />
        <NotificationBell />
        <UserMenu name={user.name} email={user.email} role={user.roleName} />
      </div>
    </header>
  );
}
