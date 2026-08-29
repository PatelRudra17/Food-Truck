import { MobileNav } from "@/components/layout/mobile-nav";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserMenu } from "@/components/layout/user-menu";
import type { SessionUser } from "@/lib/auth/session";

export function Header({ user }: { user: SessionUser }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <MobileNav permissions={user.permissions} />
      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <NotificationBell />
        <UserMenu name={user.name} email={user.email} role={user.roleName} />
      </div>
    </header>
  );
}
