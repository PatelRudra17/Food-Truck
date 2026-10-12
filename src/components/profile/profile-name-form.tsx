"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/lib/actions/profile-actions";

export function ProfileNameForm({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfileAction({ name: value });
      if (result.ok) {
        toast.success("Name updated.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm items-end gap-2">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="profile-name">Name</Label>
        <Input id="profile-name" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button type="submit" variant="outline" disabled={isPending || value.trim() === name}>
        {isPending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
