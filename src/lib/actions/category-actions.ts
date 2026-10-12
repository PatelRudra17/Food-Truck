"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { categorySchema } from "@/lib/validators/category";

/**
 * Friendly duplicate check. The DB unique index on (name, parentId) does not catch
 * duplicate top-level names because Postgres treats NULL parentIds as distinct.
 */
async function assertCategoryNameAvailable(name: string, parentId: string | null, excludeId?: string) {
  const duplicate = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      parentId,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (duplicate) {
    throw new Error(
      parentId
        ? `A subcategory named "${duplicate.name}" already exists under this parent.`
        : `A top-level category named "${duplicate.name}" already exists.`,
    );
  }
}

export async function createCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CATEGORY_CREATE");
    const data = categorySchema.parse(input);

    if (data.parentId) {
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new Error("Selected parent category was not found.");
      if (parent.parentId) throw new Error("Only one level of subcategory is allowed — choose a top-level category as the parent.");
    }

    await assertCategoryNameAvailable(data.name, data.parentId ?? null);

    const created = await prisma.category.create({
      data: {
        name: data.name,
        parentId: data.parentId ?? null,
        description: data.description ?? null,
        isActive: data.isActive,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Category",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/categories");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCategoryAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CATEGORY_EDIT");
    const data = categorySchema.parse(input);

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new Error("Category not found.");

    if (data.parentId) {
      if (data.parentId === id) throw new Error("A category cannot be its own parent.");
      const parent = await prisma.category.findUnique({ where: { id: data.parentId } });
      if (!parent) throw new Error("Selected parent category was not found.");
      if (parent.parentId) throw new Error("Only one level of subcategory is allowed — choose a top-level category as the parent.");
    }

    // If this category already has children, it cannot itself become a subcategory.
    if (data.parentId) {
      const childCount = await prisma.category.count({ where: { parentId: id } });
      if (childCount > 0) throw new Error("This category has subcategories — remove them before nesting it under another category.");
    }

    await assertCategoryNameAvailable(data.name, data.parentId ?? null, id);

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        parentId: data.parentId ?? null,
        description: data.description ?? null,
        isActive: data.isActive,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Category",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/categories");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CATEGORY_ARCHIVE");
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new Error("Category not found.");

    await prisma.category.update({ where: { id }, data: { isActive: false } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Category",
      entityId: id,
      oldValues: existing,
    });

    revalidatePath("/categories");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreCategoryAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("CATEGORY_EDIT");
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new Error("Category not found.");

    await prisma.category.update({ where: { id }, data: { isActive: true } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Category",
      entityId: id,
      oldValues: existing,
      newValues: { isActive: true },
    });

    revalidatePath("/categories");
    return { ok: true, data: { id } };
  } catch (error) {
    return actionError(error);
  }
}
