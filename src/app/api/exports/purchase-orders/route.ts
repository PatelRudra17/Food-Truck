import { NextRequest } from "next/server";
import { format } from "date-fns";
import { Prisma, POStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";

export async function GET(request: NextRequest) {
  const user = await requirePermission("PURCHASE_ORDER_EXPORT");

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q") ?? undefined;
  const rawStatus = searchParams.get("status");
  // Ignore unknown status values instead of letting Prisma throw on an invalid enum.
  const status = (Object.values(POStatus) as string[]).includes(rawStatus ?? "")
    ? (rawStatus as POStatus)
    : undefined;

  const where: Prisma.PurchaseOrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { poNumber: { contains: q, mode: "insensitive" } },
            { supplier: { companyName: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const orders = await prisma.purchaseOrder.findMany({
    where,
    orderBy: { date: "desc" },
    include: { supplier: { select: { companyName: true, code: true } } },
  });

  const buffer = await buildExcelBuffer({
    sheetName: "Purchase Orders",
    headers: [
      "PO Number",
      "Supplier",
      "Supplier Code",
      "Date",
      "Expected Delivery",
      "Total Amount",
      "Status",
    ],
    rows: orders.map((po) => [
      po.poNumber,
      po.supplier.companyName,
      po.supplier.code,
      format(po.date, "dd MMM yyyy"),
      po.expectedDelivery ? format(po.expectedDelivery, "dd MMM yyyy") : "",
      Number(po.totalAmount),
      po.status,
    ]),
  });

  await writeAuditLog({
    userId: user.id,
    action: "EXPORT",
    entityType: "PurchaseOrder",
    newValues: { count: orders.length },
  });

  return new Response(new Uint8Array(buffer), {
    headers: fileResponseHeaders(
      `purchase-orders-${format(new Date(), "yyyyMMdd-HHmmss")}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
  });
}
