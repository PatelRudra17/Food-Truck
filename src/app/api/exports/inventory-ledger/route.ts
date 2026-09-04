import { format } from "date-fns";
import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";
import { parseLedgerQuery, queryLedgerForExport } from "@/lib/services/inventory-ledger";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("INVENTORY_LEDGER_EXPORT");
    const filters = parseLedgerQuery((key) => request.nextUrl.searchParams.get(key));
    const rows0 = await queryLedgerForExport(filters);

    const headers = ["Date", "Item", "SKU", "Warehouse", "Type", "Before", "Movement", "After", "Reference", "User"];
    const rows = rows0.map((row) => [
      format(row.createdAt, "dd MMM yyyy HH:mm"),
      row.item.name,
      row.item.sku,
      row.warehouse.name,
      row.transactionType,
      Number(row.beforeQty),
      Number(row.quantity),
      Number(row.afterQty),
      row.referenceNumber,
      row.user.name,
    ]);

    const buffer = await buildExcelBuffer({
      sheetName: "Inventory Ledger",
      headers,
      rows,
    });

    await writeAuditLog({
      userId: user.id,
      action: "EXPORT",
      entityType: "InventoryLedger",
      newValues: { filters, rowCount: rows.length },
    });

    return new Response(new Uint8Array(buffer), {
      headers: fileResponseHeaders(
        `inventory-ledger-${format(new Date(), "yyyyMMdd-HHmmss")}.xlsx`,
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
