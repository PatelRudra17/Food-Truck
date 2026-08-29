import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { NAV_GROUPS } from "@/lib/nav-config";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Header } from "@/components/layout/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || user.permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
        <div className="fixed h-screen w-64">
          <SidebarNav groups={groups} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header groups={groups} user={user} />
        <main className="flex-1 overflow-x-hidden p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
