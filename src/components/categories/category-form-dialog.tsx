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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryInput } from "@/lib/validators/category";
import { createCategoryAction, updateCategoryAction } from "@/lib/actions/category-actions";

export type CategoryOption = { id: string; name: string; parentId: string | null };

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  parentId: z.string().default(""),
  description: z.string().default(""),
  isActive: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;
type FormInput = z.input<typeof formSchema>;

export function CategoryFormDialog({
  trigger,
  parentOptions,
  editing,
  onSaved,
}: {
  trigger: ReactNode;
  parentOptions: CategoryOption[];
  editing?: { id: string; name: string; parentId: string | null; description: string | null; isActive: boolean };
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
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: editing?.name ?? "",
      parentId: editing?.parentId ?? "",
      description: editing?.description ?? "",
      isActive: editing?.isActive ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: editing?.name ?? "",
        parentId: editing?.parentId ?? "",
        description: editing?.description ?? "",
        isActive: editing?.isActive ?? true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Only top-level categories may act as a parent, and a category cannot parent itself.
  const eligibleParents = parentOptions.filter((p) => p.parentId === null && p.id !== editing?.id);

  async function onSubmit(values: FormValues) {
    const payload: CategoryInput = {
      name: values.name,
      parentId: values.parentId || null,
      description: values.description || null,
      isActive: values.isActive,
    };
    const result = isEdit
      ? await updateCategoryAction(editing!.id, payload)
      : await createCategoryAction(payload);

    if (result.ok) {
      toast.success(isEdit ? "Category updated." : "Category created.");
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
            <DialogTitle>{isEdit ? "Edit Category" : "New Category"}</DialogTitle>
            <DialogDescription>
              {isEdit ? "Update this category's details." : "Create a category or a one-level subcategory."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" {...register("name")} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-parent">Parent category (optional)</Label>
              <Controller
                control={control}
                name="parentId"
                render={({ field }) => (
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger id="cat-parent" className="w-full">
                      <SelectValue placeholder="None (top-level category)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (top-level category)</SelectItem>
                      {eligibleParents.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea id="cat-desc" rows={3} {...register("description")} />
            </div>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} id="cat-active" />
                )}
              />
              <Label htmlFor="cat-active">Active</Label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
