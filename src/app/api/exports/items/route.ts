import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";
import { writeAuditLog } from "@/lib/audit";
import { buildItemOrderBy, buildItemWhere, parseItemListParams } from "@/lib/queries/item-list";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("ITEM_EXPORT");

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    const params = parseItemListParams(searchParams);
    const where = buildItemWhere(params);
    const orderBy = buildItemOrderBy(params);

    const items = await prisma.item.findMany({
      where,
      orderBy,
      include: { category: true, warehouse: true, location: true },
    });

    const headers = [
      "SKU",
      "Item Code",
      "Name",
      "Category",
      "Brand",
      "Unit",
      "Current Stock",
      "Reorder Level",
      "Min Stock",
      "Max Stock",
      "Warehouse",
      "Location",
      "Purchase Price",
      "Tax %",
      "HSN Code",
      "Barcode",
      "Status",
    ];

    const rows = items.map((i) => [
      i.sku,
      i.itemCode,
      i.name,
      i.category.name,
      i.brand ?? "",
      i.unit,
      Number(i.currentStock),
      Number(i.reorderLevel),
      Number(i.minStock),
      i.maxStock ? Number(i.maxStock) : "",
      i.warehouse?.name ?? "",
      [i.location?.rack, i.location?.shelf, i.location?.bin].filter(Boolean).join("/"),
      i.purchasePrice ? Number(i.purchasePrice) : "",
      i.taxPercent ? Number(i.taxPercent) : "",
      i.hsnCode ?? "",
      i.barcode ?? "",
      i.isActive ? "Active" : "Inactive",
    ]);

    const buffer = await buildExcelBuffer({ sheetName: "Items", headers, rows });

    await writeAuditLog({
      userId: user.id,
      action: "EXPORT",
      entityType: "Item",
      newValues: { count: items.length, filters: params },
    });

    return new Response(new Uint8Array(buffer), {
      headers: fileResponseHeaders(
        `items-export-${Date.now()}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
