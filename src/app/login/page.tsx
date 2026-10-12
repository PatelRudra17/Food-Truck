import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Only a session that is actually valid skips the login page; an expired or
  // revoked cookie lands here and can simply sign in again.
  if (await getSessionUser()) redirect("/dashboard");

  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Enterprise Inventory &amp; Logistics
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to your account to continue.</p>
        </div>
        <LoginForm next={next} />
        {process.env.NODE_ENV !== "production" && (
          <p className="text-center text-xs text-muted-foreground">
            Development credentials: any seeded user email, password{" "}
            <code className="font-mono">DevPass!2026</code>
          </p>
        )}
      </div>
    </div>
  );
}
