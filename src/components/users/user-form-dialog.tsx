"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUserAction, updateUserAction } from "@/lib/actions/user-actions";

export type RoleOption = { id: string; name: string };

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  roleId: z.string().min(1, "Role is required."),
  isActive: z.boolean(),
  password: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function UserFormDialog({
  trigger,
  roles,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  roles: RoleOption[];
  editing?: { id: string; name: string; email: string; roleId: string; isActive: boolean; isSelf: boolean };
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!editing;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editing?.name ?? "",
      email: editing?.email ?? "",
      roleId: editing?.roleId ?? "",
      isActive: editing?.isActive ?? true,
      password: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: editing?.name ?? "",
        email: editing?.email ?? "",
        roleId: editing?.roleId ?? "",
        isActive: editing?.isActive ?? true,
        password: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    if (!isEdit && (!values.password || values.password.length < 8)) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    const result = isEdit
      ? await updateUserAction(editing!.id, {
          name: values.name,
          email: values.email,
          roleId: values.roleId,
          isActive: values.isActive,
        })
      : await createUserAction({
          name: values.name,
          email: values.email,
          roleId: values.roleId,
          isActive: values.isActive,
          password: values.password,
        });

    if (result.ok) {
      toast.success(isEdit ? "User updated." : "User created.");
      setOpen(false);
      onSaved?.();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit User" : "New User"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this user's details and role." : "Create a new user account with an initial password."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="u-name">Name</Label>
              <Input id="u-name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" disabled={isEdit} {...register("email")} aria-invalid={!!errors.email} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            {!isEdit && (
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="u-password">Initial password</Label>
                <Input id="u-password" type="password" autoComplete="new-password" {...register("password")} />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              </div>
            )}

            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="u-role">Role</Label>
              <Controller
                control={control}
                name="roleId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="u-role" className="w-full" aria-invalid={!!errors.roleId}>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.roleId && <p className="text-sm text-destructive">{errors.roleId.message}</p>}
            </div>

            <div className="col-span-2 flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="u-active">Active</Label>
                <p className="text-xs text-muted-foreground">Inactive users cannot sign in.</p>
              </div>
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    id="u-active"
                    checked={field.value}
                    disabled={!!editing?.isSelf}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
