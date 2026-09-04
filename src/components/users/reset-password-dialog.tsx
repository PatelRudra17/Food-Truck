"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetUserPasswordAction } from "@/lib/actions/user-actions";

const formSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordDialog({
  trigger,
  userId,
  userName,
}: {
  trigger: ReactNode;
  userId: string;
  userName: string;
}) {
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { newPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    const result = await resetUserPasswordAction(userId, values);
    if (result.ok) {
      toast.success(`Password reset for ${userName}.`);
      reset({ newPassword: "" });
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset({ newPassword: "" });
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {userName}. Their existing sessions will be signed out.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-1.5">
            <Label htmlFor="reset-pw">New password</Label>
            <Input
              id="reset-pw"
              type="password"
              autoComplete="new-password"
              {...register("newPassword")}
              aria-invalid={!!errors.newPassword}
            />
            {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Reset password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
