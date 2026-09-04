"use client";

import { useRouter } from "next/navigation";
import { Plus, Pencil, Archive, RotateCcw, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { CategoryFormDialog, type CategoryOption } from "@/components/categories/category-form-dialog";
import { archiveCategoryAction, restoreCategoryAction } from "@/lib/actions/category-actions";

export type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  itemCount: number;
  childCount: number;
};

export function CategoriesClient({
  categories,
  canCreate,
  canEdit,
  canArchive,
}: {
  categories: CategoryRow[];
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const parentOptions: CategoryOption[] = categories.map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }));

  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canCreate && (
          <CategoryFormDialog
            trigger={
              <Button size="sm">
                <Plus /> New Category
              </Button>
            }
            parentOptions={parentOptions}
            onSaved={refresh}
          />
        )}
      </div>

      {roots.length === 0 ? (
        <EmptyState icon={Tags} title="No categories yet" description="Create your first category to start organizing items." />
      ) : (
        <div className="divide-y rounded-md border">
          {roots.map((root) => (
            <div key={root.id}>
              <CategoryRowItem
                row={root}
                depth={0}
                parentOptions={parentOptions}
                canEdit={canEdit}
                canArchive={canArchive}
                onChanged={refresh}
              />
              {childrenOf(root.id).map((child) => (
                <CategoryRowItem
                  key={child.id}
                  row={child}
                  depth={1}
                  parentOptions={parentOptions}
                  canEdit={canEdit}
                  canArchive={canArchive}
                  onChanged={refresh}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRowItem({
  row,
  depth,
  parentOptions,
  canEdit,
  canArchive,
  onChanged,
}: {
  row: CategoryRow;
  depth: number;
  parentOptions: CategoryOption[];
  canEdit: boolean;
  canArchive: boolean;
  onChanged: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ paddingLeft: `${1 + depth * 1.5}rem` }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{row.name}</span>
          {!row.isActive && (
            <Badge variant="outline" className="bg-muted text-muted-foreground">
              Archived
            </Badge>
          )}
          {row.childCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {row.childCount} subcategor{row.childCount === 1 ? "y" : "ies"}
            </Badge>
          )}
        </div>
        {row.description && <p className="truncate text-sm text-muted-foreground">{row.description}</p>}
        <p className="text-xs text-muted-foreground">{row.itemCount} item(s)</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {canEdit && (
          <CategoryFormDialog
            trigger={
              <Button variant="outline" size="icon-sm">
                <Pencil />
              </Button>
            }
            parentOptions={parentOptions}
            editing={row}
            onSaved={onChanged}
          />
        )}
        {canArchive &&
          (row.isActive ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="icon-sm">
                  <Archive />
                </Button>
              }
              title="Archive category?"
              description={`"${row.name}" will be hidden from item creation but items already assigned to it are unaffected.`}
              confirmLabel="Archive"
              destructive
              onConfirm={() => archiveCategoryAction(row.id)}
              onSuccess={onChanged}
            />
          ) : (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="icon-sm">
                  <RotateCcw />
                </Button>
              }
              title="Restore category?"
              description={`"${row.name}" will become active again.`}
              confirmLabel="Restore"
              onConfirm={() => restoreCategoryAction(row.id)}
              onSuccess={onChanged}
            />
          ))}
      </div>
    </div>
  );
}
