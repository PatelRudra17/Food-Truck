import { unstable_rethrow } from "next/navigation";
import type { NextRequest } from "next/server";
import { format } from "date-fns";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { buildCsv, buildExcelBuffer, fileResponseHeaders } from "@/lib/services/export";
import {
  REPORT_COLUMNS,
  canAccessReport,
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
    if (!canAccessReport(type, user.permissions)) {
      return new Response(JSON.stringify({ error: "You do not have permission to export this report." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const requestedFormat = request.nextUrl.searchParams.get("format") || "xlsx";
    if (requestedFormat !== "xlsx" && requestedFormat !== "csv") {
      return new Response(JSON.stringify({ error: "Unsupported format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const formatType: "xlsx" | "csv" = requestedFormat;

    const filters = parseReportFilters(Object.fromEntries(request.nextUrl.searchParams.entries()));
    const result = await getReportRows(type, { ...filters, page: "1", pageSize: "5000" });
    const columns = result.columns ?? REPORT_COLUMNS[type];
    const headers = columns.map((column) => column.label);
    const rows = result.rows.map((row) => columns.map((column) => formatExportValue(row[column.key])));

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
    unstable_rethrow(error); // let a 403 from requirePermission through
    const message = error instanceof Error ? error.message : "Export failed.";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}
