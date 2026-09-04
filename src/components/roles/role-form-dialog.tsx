"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createRoleAction, updateRoleAction } from "@/lib/actions/role-actions";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().default(""),
});

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export function RoleFormDialog({
  trigger,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  editing?: { id: string; name: string; description: string | null };
  onSaved?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!editing;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: editing?.name ?? "", description: editing?.description ?? "" },
  });

  useEffect(() => {
    if (open) reset({ name: editing?.name ?? "", description: editing?.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: FormValues) {
    const payload = { name: values.name, description: values.description || null };
    const result = isEdit ? await updateRoleAction(editing!.id, payload) : await createRoleAction(payload);

    if (result.ok) {
      toast.success(isEdit ? "Role updated." : "Role created.");
      setOpen(false);
      onSaved?.(result.data.id);
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
            <DialogTitle>{isEdit ? "Edit Role" : "New Role"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this role's name and description." : "Create a custom role. Permissions are set afterwards."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea id="role-desc" rows={3} {...register("description")} />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
