"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeMyPasswordAction, revokeOtherSessionsAction } from "@/lib/actions/profile-actions";
import { passwordPolicyError } from "@/lib/validators/user";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function ChangePasswordForm() {
  const [values, setValues] = useState(EMPTY);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set(field: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [field]: e.target.value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const policyError = passwordPolicyError(values.newPassword);
    setNewPasswordError(policyError);
    if (policyError) return;
    if (values.newPassword !== values.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    startTransition(async () => {
      const result = await changeMyPasswordAction({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (result.ok) {
        // A changed password should sign out any other device using the old one.
        await revokeOtherSessionsAction();
        toast.success("Password changed. Other devices have been signed out.");
        setValues(EMPTY);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-sm space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={set("currentPassword")}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={set("newPassword")}
          aria-invalid={!!newPasswordError}
          aria-describedby="newPassword-help"
        />
        <p
          id="newPassword-help"
          className={newPasswordError ? "text-sm text-destructive" : "text-xs text-muted-foreground"}
        >
          {newPasswordError ?? "At least 8 characters, with a letter and a number."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Change password"}
      </Button>
    </form>
  );
}
