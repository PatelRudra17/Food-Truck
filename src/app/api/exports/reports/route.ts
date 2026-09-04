import type { NextRequest } from "next/server";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { buildCsv, buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";
import {
  REPORT_COLUMNS,
  formatExportValue,
  getReportRows,
  isReportType,
  parseReportFilters,
} from "@/lib/services/reports";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("REPORT_EXPORT");
    const type = request.nextUrl.searchParams.get("type");
    if (!type || !isReportType(type)) {
      return new Response(JSON.stringify({ error: "Invalid report type." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (type === "audit-log" && !user.permissions.includes("VIEW_AUDIT_LOG")) {
      return new Response(JSON.stringify({ error: "You do not have permission to export the audit log." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const filters = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const result = await getReportRows(type, { ...filters, page: "1", pageSize: "5000" });
    const columns = REPORT_COLUMNS[type];
    const headers = columns.map((column) => column.label);
    const rows = result.rows.map((row) => columns.map((column) => formatExportValue(row[column.key])));
    const formatType = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "xlsx";

    await writeAuditLog({
      userId: user.id,
      action: "EXPORT",
      entityType: `Report:${type}`,
      newValues: { filters, rowCount: rows.length, format: formatType },
    });

    if (formatType === "csv") {
      const csv = buildCsv(headers, rows);
      return new Response(csv, {
        headers: fileResponseHeaders(`report-${type}-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`, "text/csv"),
      });
    }

    const buffer = await buildExcelBuffer({
      sheetName: type.slice(0, 31),
      headers,
      rows,
    });

    return new Response(new Uint8Array(buffer), {
      headers: fileResponseHeaders(
        `report-${type}-${format(new Date(), "yyyyMMdd-HHmmss")}.xlsx`,
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
