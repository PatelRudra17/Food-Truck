import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "No access" };

/** Rendered (with a 403 status) when requirePermission denies a page or route. */
export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="max-w-sm space-y-4 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">You don&apos;t have access to this page</h1>
          <p className="text-sm text-muted-foreground">
            Your role doesn&apos;t include permission for it. Ask an administrator if you need access.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
