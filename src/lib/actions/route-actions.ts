"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";
import { routeClusterSchema, routeSchema } from "@/lib/validators/route";

/** Auto-generates the next sequential `RT-###` route number. Master data only —
 * not high-volume enough to need `nextDocumentNumber`/`NumberSequence`. */
async function generateRouteNumber(tx: Prisma.TransactionClient): Promise<string> {
  const count = await tx.route.count();
  return `RT-${String(count + 1).padStart(3, "0")}`;
}

// ==================================================
// ROUTE CLUSTERS
// ==================================================

export async function createRouteClusterAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_CREATE");
    const data = routeClusterSchema.parse(input);

    const created = await prisma.routeCluster.create({
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "RouteCluster",
      entityId: created.id,
      newValues: data,
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A cluster with this name already exists." };
    }
    return actionError(error);
  }
}

export async function updateRouteClusterAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_EDIT");
    const data = routeClusterSchema.parse(input);
    const existing = await prisma.routeCluster.findUniqueOrThrow({ where: { id } });

    const updated = await prisma.routeCluster.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "RouteCluster",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A cluster with this name already exists." };
    }
    return actionError(error);
  }
}

export async function archiveRouteClusterAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_ARCHIVE");
    const existing = await prisma.routeCluster.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.routeCluster.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "RouteCluster",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateRouteClusterAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_EDIT");
    const existing = await prisma.routeCluster.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.routeCluster.update({ where: { id }, data: { status: "ACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "RouteCluster",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "ACTIVE" },
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

// ==================================================
// ROUTES
// ==================================================

export async function createRouteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_CREATE");
    const data = routeSchema.parse(input);

    if (data.routeClusterId) {
      const cluster = await prisma.routeCluster.findUnique({ where: { id: data.routeClusterId } });
      if (!cluster) throw new Error("Selected cluster does not exist.");
    }

    const created = await prisma.$transaction(async (tx) => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 5; attempt++) {
        const routeNumber = await generateRouteNumber(tx);
        try {
          return await tx.route.create({
            data: {
              routeNumber,
              name: data.name,
              startLocation: data.startLocation,
              destination: data.destination,
              routeClusterId: data.routeClusterId,
              estimatedDistanceKm: data.estimatedDistanceKm,
              estimatedTimeMinutes: data.estimatedTimeMinutes,
              status: data.status,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            lastError = error;
            continue;
          }
          throw error;
        }
      }
      throw lastError instanceof Error ? lastError : new Error("Failed to generate a unique route number.");
    });

    await writeAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Route",
      entityId: created.id,
      newValues: { ...data, routeNumber: created.routeNumber },
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A route with this number already exists. Please try again." };
    }
    return actionError(error);
  }
}

export async function updateRouteAction(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_EDIT");
    const data = routeSchema.parse(input);
    const existing = await prisma.route.findUniqueOrThrow({ where: { id } });

    if (data.routeClusterId) {
      const cluster = await prisma.routeCluster.findUnique({ where: { id: data.routeClusterId } });
      if (!cluster) throw new Error("Selected cluster does not exist.");
    }

    const updated = await prisma.route.update({
      where: { id },
      data: {
        name: data.name,
        startLocation: data.startLocation,
        destination: data.destination,
        routeClusterId: data.routeClusterId,
        estimatedDistanceKm: data.estimatedDistanceKm,
        estimatedTimeMinutes: data.estimatedTimeMinutes,
        status: data.status,
      },
    });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Route",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveRouteAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_ARCHIVE");
    const existing = await prisma.route.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.route.update({ where: { id }, data: { status: "INACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Route",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "INACTIVE" },
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}

export async function reactivateRouteAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ROUTE_EDIT");
    const existing = await prisma.route.findUniqueOrThrow({ where: { id } });
    const updated = await prisma.route.update({ where: { id }, data: { status: "ACTIVE" } });

    await writeAuditLog({
      userId: user.id,
      action: "EDIT",
      entityType: "Route",
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: "ACTIVE" },
    });

    revalidatePath("/routes");
    return { ok: true, data: { id: updated.id } };
  } catch (error) {
    return actionError(error);
  }
}
