import { requireUser } from "@/lib/auth/guard";
import { getMySessions } from "@/lib/actions/profile-actions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileNameForm } from "@/components/profile/profile-name-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { SessionList } from "@/components/profile/session-list";

export const metadata = { title: "Profile & Account" };

export default async function ProfilePage() {
  const user = await requireUser();
  const sessions = await getMySessions();

  return (
    <div className="space-y-6">
      <PageHeader title="Profile & Account" description="Your account details, password and signed-in devices." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="mt-0.5 font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="mt-0.5 font-medium">{user.roleName}</dd>
            </div>
          </dl>
          <ProfileNameForm name={user.name} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Signed-in sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionList
            sessions={sessions.map((s) => ({
              id: s.id,
              ipAddress: s.ipAddress,
              userAgent: s.userAgent,
              createdAt: s.createdAt.toISOString(),
              isCurrent: s.isCurrent,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
