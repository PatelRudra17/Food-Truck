import ExcelJS from "exceljs";

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export async function buildExcelBuffer(params: {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(params.sheetName);
  sheet.addRow(params.headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of params.rows) {
    sheet.addRow(row);
  }
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function fileResponseHeaders(filename: string, mimeType: string) {
  return {
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename="${filename}"`,
  };
}
