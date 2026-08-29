import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Enterprise Inventory &amp; Logistics
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to your account to continue.</p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-muted-foreground">
          Development credentials: any seeded user email, password{" "}
          <code className="font-mono">DevPass!2026</code>
        </p>
      </div>
    </div>
  );
}
