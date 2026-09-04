"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RESOURCES, ACTIONS, SPECIAL_PERMISSIONS } from "@/lib/auth/permissions";
import { saveRolePermissionsAction } from "@/lib/actions/role-actions";

function humanizeResource(resource: string) {
  return resource
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function humanizeSpecial(code: string) {
  return code
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function PermissionMatrix({
  roleId,
  initialCodes,
  disabled,
}: {
  roleId: string;
  initialCodes: string[];
  disabled?: boolean;
}) {
  const [codes, setCodes] = useState<Set<string>>(new Set(initialCodes));
  const [isPending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    if (codes.size !== initialCodes.length) return true;
    for (const c of initialCodes) if (!codes.has(c)) return true;
    return false;
  }, [codes, initialCodes]);

  function toggle(code: string) {
    if (disabled) return;
    setCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleRow(resource: string, checkAll: boolean) {
    if (disabled) return;
    setCodes((prev) => {
      const next = new Set(prev);
      for (const action of ACTIONS) {
        const code = `${resource}_${action}`;
        if (checkAll) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveRolePermissionsAction({ roleId, permissionCodes: Array.from(codes) });
      if (result.ok) {
        toast.success("Permissions saved.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleReset() {
    setCodes(new Set(initialCodes));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resource Permissions</CardTitle>
          <CardDescription>Toggle which actions this role can perform on each resource.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium">Resource</th>
                  {ACTIONS.map((action) => (
                    <th key={action} className="px-3 py-2 text-center font-medium whitespace-nowrap">
                      {humanizeSpecial(action)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">All</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((resource) => {
                  const rowCodes = ACTIONS.map((a) => `${resource}_${a}`);
                  const allChecked = rowCodes.every((c) => codes.has(c));
                  return (
                    <tr key={resource} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="sticky left-0 bg-background px-3 py-2 font-medium whitespace-nowrap">
                        {humanizeResource(resource)}
                      </td>
                      {ACTIONS.map((action) => {
                        const code = `${resource}_${action}`;
                        return (
                          <td key={code} className="px-3 py-2 text-center">
                            <Checkbox
                              checked={codes.has(code)}
                              disabled={disabled}
                              onCheckedChange={() => toggle(code)}
                              aria-label={code}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <Checkbox
                          checked={allChecked}
                          disabled={disabled}
                          onCheckedChange={(v) => toggleRow(resource, !!v)}
                          aria-label={`${resource}_ALL`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Special Permissions</CardTitle>
          <CardDescription>Standalone capabilities not tied to a single resource/action pair.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SPECIAL_PERMISSIONS.map((code) => (
              <label key={code} className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <Checkbox checked={codes.has(code)} disabled={disabled} onCheckedChange={() => toggle(code)} />
                {humanizeSpecial(code)}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {!disabled && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={handleReset} disabled={!dirty || isPending}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!dirty || isPending}>
            {isPending ? "Saving..." : "Save Permissions"}
          </Button>
        </div>
      )}
    </div>
  );
}
