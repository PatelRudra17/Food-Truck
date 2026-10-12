import "server-only";
import { format } from "date-fns";
import { Prisma, LedgerTxnType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOverdueDays } from "@/lib/services/crate-alerts";
import type { PermissionCode } from "@/lib/auth/permissions";
import { likePattern, matchesQuery, normalizeQuery, paginateRows, parseReportPage } from "@/lib/services/report-utils";

// ==================================================
// Types shared by the report landing page, the
// dynamic /reports/[type] page, the print view and
// the export route handler.
// ==================================================

export const REPORT_TYPES = [
  "current-stock",
  "stock-ledger",
  "inward",
  "outward",
  "transfer",
  "adjustment",
  "warehouse-stock",
  "item-wise",
  "category-wise",
  "supplier-wise",
  "date-wise",
  "low-stock",
  "out-of-stock",
  "damaged-stock",
  "expired-stock",
  "vehicle-entry-exit",
  "driver-list",
  "vehicle-list",
  "driver-document-expiry",
  "vehicle-document-expiry",
  "purchase-order",
  "procurement",
  "procurement-batch",
  "vendor-wise-procurement",
  "sorting-yield",
  "wastage",
  "sales-order",
  "customer-wise-sales",
  "trip",
  "crate-status",
  "crate-overdue",
  "crate-customer-balance",
  "fuel",
  "maintenance",
  "payroll-summary",
  "audit-log",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export interface ReportFilters {
  q?: string;
  warehouseId?: string;
  categoryId?: string;
  supplierId?: string;
  itemId?: string;
  customerId?: string;
  status?: string;
  ledgerType?: string;
  entityType?: string;
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  windowDays?: string;
  page?: string;
  pageSize?: string;
}

function pick(sp: RawSearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

export function parseReportFilters(sp: RawSearchParams): ReportFilters {
  return {
    q: pick(sp, "q"),
    warehouseId: pick(sp, "warehouseId"),
    categoryId: pick(sp, "categoryId"),
    supplierId: pick(sp, "supplierId"),
    itemId: pick(sp, "itemId"),
    customerId: pick(sp, "customerId"),
    status: pick(sp, "status"),
    ledgerType: pick(sp, "ledgerType"),
    entityType: pick(sp, "entityType"),
    action: pick(sp, "action"),
    userId: pick(sp, "userId"),
    dateFrom: pick(sp, "dateFrom"),
    dateTo: pick(sp, "dateTo"),
    windowDays: pick(sp, "windowDays"),
    page: pick(sp, "page"),
    pageSize: pick(sp, "pageSize"),
  };
}

export interface ReportResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  /** Overrides REPORT_COLUMNS[type] when a report's shape depends on its filters. */
  columns?: ReportColumn[];
}

function parsePage(filters: ReportFilters) {
  return parseReportPage(filters);
}

/** Case-insensitive "contains" condition for the report search box. */
function ci(q: string) {
  return { contains: q, mode: "insensitive" as const };
}

function parseDateRange(filters: ReportFilters): { gte?: Date; lte?: Date } | undefined {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (filters.dateFrom) range.gte = new Date(`${filters.dateFrom}T00:00:00.000`);
  if (filters.dateTo) range.lte = new Date(`${filters.dateTo}T23:59:59.999`);
  return range;
}

function num(v: Prisma.Decimal | number | null | undefined): number {
  return v === null || v === undefined ? 0 : Number(v);
}

// ==================================================
// Landing page metadata + per-report filter/column config
// ==================================================

export interface ReportDef {
  type: ReportType;
  label: string;
  description: string;
}

export const REPORT_GROUPS: { title: string; reports: ReportDef[] }[] = [
  {
    title: "Stock Reports",
    reports: [
      { type: "current-stock", label: "Current Stock", description: "Item-level stock on hand across warehouses." },
      { type: "stock-ledger", label: "Stock Ledger", description: "Every inventory movement, oldest to newest." },
      { type: "warehouse-stock", label: "Warehouse Stock", description: "Stock totals grouped by warehouse." },
      { type: "item-wise", label: "Item-wise Report", description: "Inward/outward volume and stock per item." },
      { type: "category-wise", label: "Category-wise Report", description: "Stock totals grouped by category." },
      { type: "supplier-wise", label: "Supplier-wise Report", description: "Stock and PO value grouped by supplier." },
      { type: "date-wise", label: "Date-wise Movement", description: "Daily inward/outward volume in a date range." },
      { type: "low-stock", label: "Low Stock", description: "Items at or below their reorder level." },
      { type: "out-of-stock", label: "Out of Stock", description: "Items with zero or negative stock." },
      { type: "damaged-stock", label: "Damaged Stock", description: "Ledger entries for damaged/disposed stock." },
      { type: "expired-stock", label: "Expired Stock", description: "Received batches past their expiry date." },
    ],
  },
  {
    title: "Stock Movements",
    reports: [
      { type: "inward", label: "Stock Inward", description: "Inward documents and their status." },
      { type: "outward", label: "Stock Outward", description: "Outward documents and their status." },
      { type: "transfer", label: "Stock Transfer", description: "Inter-warehouse transfers and their status." },
      { type: "adjustment", label: "Stock Adjustment", description: "Physical count adjustments and their status." },
    ],
  },
  {
    title: "Fleet & Logistics",
    reports: [
      { type: "vehicle-entry-exit", label: "Vehicle Entry / Exit", description: "Gate entry and exit activity." },
      { type: "driver-list", label: "Driver List", description: "All drivers and their status." },
      { type: "vehicle-list", label: "Vehicle List", description: "All vehicles and their status." },
      { type: "driver-document-expiry", label: "Driver Document Expiry", description: "Driver documents expiring soon or expired." },
      { type: "vehicle-document-expiry", label: "Vehicle Document Expiry", description: "Vehicle documents expiring soon or expired." },
      { type: "fuel", label: "Fuel", description: "Fuel entries, mileage and cost/KM per vehicle." },
      { type: "maintenance", label: "Maintenance", description: "Service history, cost and schedule status per vehicle." },
    ],
  },
  {
    title: "Procurement",
    reports: [
      { type: "purchase-order", label: "Purchase Orders", description: "Purchase orders, status and value." },
      { type: "procurement", label: "Procurement", description: "Procurement documents, vendor and vehicle traceability." },
      { type: "procurement-batch", label: "Procurement Batches", description: "Raw material batches and their sorting status." },
      {
        type: "vendor-wise-procurement",
        label: "Vendor-wise Procurement",
        description: "Batch count, raw weight and wastage grouped by supplier.",
      },
    ],
  },
  {
    title: "Sorting & Wastage",
    reports: [
      { type: "sorting-yield", label: "Sorting Yield", description: "Grade-wise output and yield percentage per batch." },
      { type: "wastage", label: "Wastage", description: "Wastage recorded during sorting or in the warehouse." },
    ],
  },
  {
    title: "Sales",
    reports: [
      { type: "sales-order", label: "Sales Orders", description: "Sales orders, status and value." },
      {
        type: "customer-wise-sales",
        label: "Customer-wise Sales",
        description: "Order count, quantity and value grouped by customer.",
      },
    ],
  },
  {
    title: "Dispatch & Crates",
    reports: [
      { type: "trip", label: "Trips", description: "Dispatch trips, vehicle, driver and route." },
      { type: "crate-status", label: "Crate Status", description: "Crates by status and current location." },
      { type: "crate-overdue", label: "Overdue Crates", description: "Crates with a customer longer than the overdue threshold." },
      {
        type: "crate-customer-balance",
        label: "Customer-wise Crate Balance",
        description: "Dispatched, returned, damaged, missing and pending crates per customer.",
      },
    ],
  },
  {
    title: "Workforce",
    reports: [
      { type: "payroll-summary", label: "Payroll Summary", description: "Salary records, earnings and payment status." },
    ],
  },
  {
    title: "Compliance",
    reports: [{ type: "audit-log", label: "Audit Log", description: "System-wide audit trail (requires audit log access)." }],
  },
];

/**
 * The module permission each report needs on top of REPORT_VIEW / REPORT_EXPORT,
 * so a report never shows data from a module the user can't open (e.g. salaries).
 */
const REPORT_MODULE_PERMISSION: Record<ReportType, PermissionCode> = {
  "current-stock": "ITEM_VIEW",
  "stock-ledger": "INVENTORY_LEDGER_VIEW",
  "warehouse-stock": "ITEM_VIEW",
  "item-wise": "ITEM_VIEW",
  "category-wise": "ITEM_VIEW",
  "supplier-wise": "SUPPLIER_VIEW",
  "date-wise": "INVENTORY_LEDGER_VIEW",
  "low-stock": "ITEM_VIEW",
  "out-of-stock": "ITEM_VIEW",
  "damaged-stock": "INVENTORY_LEDGER_VIEW",
  "expired-stock": "ITEM_VIEW",
  inward: "STOCK_INWARD_VIEW",
  outward: "STOCK_OUTWARD_VIEW",
  transfer: "STOCK_TRANSFER_VIEW",
  adjustment: "STOCK_ADJUSTMENT_VIEW",
  "vehicle-entry-exit": "GATE_ENTRY_VIEW",
  "driver-list": "DRIVER_VIEW",
  "vehicle-list": "VEHICLE_VIEW",
  "driver-document-expiry": "DRIVER_VIEW",
  "vehicle-document-expiry": "VEHICLE_VIEW",
  fuel: "FUEL_VIEW",
  maintenance: "MAINTENANCE_VIEW",
  "purchase-order": "PURCHASE_ORDER_VIEW",
  procurement: "PROCUREMENT_VIEW",
  "procurement-batch": "PROCUREMENT_VIEW",
  "vendor-wise-procurement": "PROCUREMENT_VIEW",
  "sorting-yield": "SORTING_VIEW",
  wastage: "WASTAGE_VIEW",
  "sales-order": "SALES_ORDER_VIEW",
  "customer-wise-sales": "SALES_ORDER_VIEW",
  trip: "TRIP_VIEW",
  "crate-status": "CRATE_VIEW",
  "crate-overdue": "CRATE_VIEW",
  "crate-customer-balance": "CRATE_VIEW",
  "payroll-summary": "PAYROLL_VIEW",
  "audit-log": "VIEW_AUDIT_LOG",
};

export function canAccessReport(type: ReportType, permissions: readonly string[]): boolean {
  return permissions.includes(REPORT_MODULE_PERMISSION[type]);
}

export function getReportDef(type: ReportType): ReportDef {
  for (const group of REPORT_GROUPS) {
    const found = group.reports.find((r) => r.type === type);
    if (found) return found;
  }
  return { type, label: type, description: "" };
}

export interface ReportColumn {
  key: string;
  label: string;
}

export const REPORT_COLUMNS: Record<ReportType, ReportColumn[]> = {
  "current-stock": [
    { key: "itemCode", label: "Item Code" },
    { key: "name", label: "Item Name" },
    { key: "sku", label: "SKU" },
    { key: "category", label: "Category" },
    { key: "warehouse", label: "Warehouse" },
    { key: "unit", label: "Unit" },
    { key: "currentStock", label: "Current Stock" },
    { key: "minStock", label: "Min Stock" },
    { key: "reorderLevel", label: "Reorder Level" },
  ],
  "stock-ledger": [
    { key: "createdAt", label: "Date" },
    { key: "item", label: "Item" },
    { key: "sku", label: "SKU" },
    { key: "warehouse", label: "Warehouse" },
    { key: "type", label: "Type" },
    { key: "quantity", label: "Quantity" },
    { key: "beforeQty", label: "Before" },
    { key: "afterQty", label: "After" },
    { key: "referenceNumber", label: "Reference" },
    { key: "user", label: "User" },
  ],
  inward: [
    { key: "inwardNumber", label: "Inward No." },
    { key: "date", label: "Date" },
    { key: "supplier", label: "Supplier" },
    { key: "warehouse", label: "Warehouse" },
    { key: "receivedBy", label: "Received By" },
    { key: "itemCount", label: "Items" },
    { key: "status", label: "Status" },
  ],
  outward: [
    { key: "outwardNumber", label: "Outward No." },
    { key: "date", label: "Date" },
    { key: "warehouse", label: "Warehouse" },
    { key: "requestedBy", label: "Requested By" },
    { key: "destination", label: "Destination" },
    { key: "itemCount", label: "Items" },
    { key: "status", label: "Status" },
  ],
  transfer: [
    { key: "transferNumber", label: "Transfer No." },
    { key: "sourceWarehouse", label: "From" },
    { key: "destWarehouse", label: "To" },
    { key: "requestedBy", label: "Requested By" },
    { key: "itemCount", label: "Items" },
    { key: "status", label: "Status" },
  ],
  adjustment: [
    { key: "adjustmentNumber", label: "Adjustment No." },
    { key: "item", label: "Item" },
    { key: "warehouse", label: "Warehouse" },
    { key: "currentQty", label: "System Qty" },
    { key: "physicalQty", label: "Physical Qty" },
    { key: "difference", label: "Difference" },
    { key: "reason", label: "Reason" },
    { key: "status", label: "Status" },
  ],
  "warehouse-stock": [
    { key: "warehouse", label: "Warehouse" },
    { key: "itemCount", label: "Item Count" },
    { key: "totalStock", label: "Total Stock" },
  ],
  "item-wise": [
    { key: "name", label: "Item" },
    { key: "sku", label: "SKU" },
    { key: "category", label: "Category" },
    { key: "warehouse", label: "Warehouse" },
    { key: "currentStock", label: "Current Stock" },
    { key: "inwardQty", label: "Inward Qty (range)" },
    { key: "outwardQty", label: "Outward Qty (range)" },
  ],
  "category-wise": [
    { key: "category", label: "Category" },
    { key: "itemCount", label: "Item Count" },
    { key: "totalStock", label: "Total Stock" },
  ],
  "supplier-wise": [
    { key: "supplier", label: "Supplier" },
    { key: "itemCount", label: "Item Count" },
    { key: "totalStock", label: "Total Stock" },
    { key: "totalPOAmount", label: "Total PO Amount" },
  ],
  "date-wise": [
    { key: "date", label: "Date" },
    { key: "inwardQty", label: "Inward Qty" },
    { key: "outwardQty", label: "Outward Qty" },
  ],
  "low-stock": [
    { key: "itemCode", label: "Item Code" },
    { key: "name", label: "Item" },
    { key: "categoryName", label: "Category" },
    { key: "warehouseName", label: "Warehouse" },
    { key: "currentStock", label: "Current Stock" },
    { key: "reorderLevel", label: "Reorder Level" },
    { key: "unit", label: "Unit" },
  ],
  "out-of-stock": [
    { key: "itemCode", label: "Item Code" },
    { key: "name", label: "Item" },
    { key: "category", label: "Category" },
    { key: "warehouse", label: "Warehouse" },
    { key: "currentStock", label: "Current Stock" },
    { key: "reorderLevel", label: "Reorder Level" },
    { key: "unit", label: "Unit" },
  ],
  "damaged-stock": [
    { key: "createdAt", label: "Date" },
    { key: "item", label: "Item" },
    { key: "sku", label: "SKU" },
    { key: "warehouse", label: "Warehouse" },
    { key: "quantity", label: "Quantity" },
    { key: "reason", label: "Reason" },
    { key: "referenceNumber", label: "Reference" },
    { key: "user", label: "User" },
  ],
  "expired-stock": [
    { key: "item", label: "Item" },
    { key: "sku", label: "SKU" },
    { key: "category", label: "Category" },
    { key: "warehouse", label: "Warehouse" },
    { key: "batchNumber", label: "Batch" },
    { key: "quantity", label: "Quantity" },
    { key: "unit", label: "Unit" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "inwardNumber", label: "Inward No." },
  ],
  "vehicle-entry-exit": [
    { key: "gateEntryNumber", label: "Gate Entry No." },
    { key: "vehicle", label: "Vehicle" },
    { key: "driver", label: "Driver" },
    { key: "supplier", label: "Supplier" },
    { key: "purpose", label: "Purpose" },
    { key: "timeIn", label: "Time In" },
    { key: "timeOut", label: "Time Out" },
    { key: "status", label: "Status" },
  ],
  "driver-list": [
    { key: "employeeId", label: "Employee ID" },
    { key: "fullName", label: "Name" },
    { key: "mobile", label: "Mobile" },
    { key: "status", label: "Status" },
    { key: "joiningDate", label: "Joining Date" },
  ],
  "vehicle-list": [
    { key: "vehicleNumber", label: "Vehicle No." },
    { key: "vehicleType", label: "Type" },
    { key: "currentDriver", label: "Current Driver" },
    { key: "status", label: "Status" },
    { key: "maintenanceState", label: "Maintenance" },
  ],
  "driver-document-expiry": [
    { key: "driver", label: "Driver" },
    { key: "docType", label: "Document Type" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "bucket", label: "Status" },
    { key: "verificationStatus", label: "Verification" },
  ],
  "vehicle-document-expiry": [
    { key: "vehicle", label: "Vehicle" },
    { key: "docType", label: "Document Type" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "bucket", label: "Status" },
    { key: "verificationStatus", label: "Verification" },
  ],
  "purchase-order": [
    { key: "poNumber", label: "PO No." },
    { key: "supplier", label: "Supplier" },
    { key: "date", label: "Date" },
    { key: "itemCount", label: "Items" },
    { key: "totalAmount", label: "Total Amount" },
    { key: "status", label: "Status" },
  ],
  procurement: [
    { key: "procurementNumber", label: "Procurement No." },
    { key: "date", label: "Date" },
    { key: "supplier", label: "Supplier" },
    { key: "vehicle", label: "Vehicle" },
    { key: "warehouse", label: "Warehouse" },
    { key: "itemCount", label: "Items" },
    { key: "status", label: "Status" },
  ],
  "procurement-batch": [
    { key: "batchNumber", label: "Batch No." },
    { key: "item", label: "Item" },
    { key: "supplier", label: "Supplier" },
    { key: "rawWeight", label: "Raw Weight" },
    { key: "status", label: "Status" },
    { key: "date", label: "Date" },
  ],
  "vendor-wise-procurement": [
    { key: "supplier", label: "Supplier" },
    { key: "batchCount", label: "Batch Count" },
    { key: "totalRawWeight", label: "Total Raw Weight" },
    { key: "totalWastage", label: "Total Wastage" },
  ],
  "sorting-yield": [
    { key: "batch", label: "Batch" },
    { key: "item", label: "Item" },
    { key: "rawWeight", label: "Raw Weight" },
    { key: "gradeAWeight", label: "Grade A" },
    { key: "gradeBWeight", label: "Grade B" },
    { key: "gradeCWeight", label: "Grade C" },
    { key: "otherGradeWeight", label: "Other Grade" },
    { key: "wasteWeight", label: "Waste Weight" },
    { key: "yieldPercent", label: "Yield %" },
  ],
  wastage: [
    { key: "wastageNumber", label: "Wastage No." },
    { key: "item", label: "Item" },
    { key: "stage", label: "Stage" },
    { key: "quantity", label: "Quantity" },
    { key: "reason", label: "Reason" },
    { key: "date", label: "Date" },
    { key: "recordedBy", label: "Recorded By" },
  ],
  "sales-order": [
    { key: "soNumber", label: "SO No." },
    { key: "customer", label: "Customer" },
    { key: "orderDate", label: "Order Date" },
    { key: "itemCount", label: "Items" },
    { key: "totalAmount", label: "Total Amount" },
    { key: "status", label: "Status" },
  ],
  "customer-wise-sales": [
    { key: "customer", label: "Customer" },
    { key: "orderCount", label: "Order Count" },
    { key: "totalQuantity", label: "Total Quantity" },
    { key: "totalAmount", label: "Total Amount" },
  ],
  trip: [
    { key: "tripNumber", label: "Trip No." },
    { key: "customer", label: "Customer" },
    { key: "vehicle", label: "Vehicle" },
    { key: "driver", label: "Driver" },
    { key: "route", label: "Route" },
    { key: "status", label: "Status" },
    { key: "departureAt", label: "Departure" },
  ],
  "crate-status": [
    { key: "crateCode", label: "Crate Code" },
    { key: "crateType", label: "Crate Type" },
    { key: "status", label: "Status" },
    { key: "currentLocation", label: "Current Location" },
  ],
  "crate-overdue": [
    { key: "crateCode", label: "Crate Code" },
    { key: "crateType", label: "Crate Type" },
    { key: "customer", label: "Customer" },
    { key: "daysWithCustomer", label: "Days With Customer" },
    { key: "thresholdDays", label: "Overdue Threshold (days)" },
  ],
  "crate-customer-balance": [
    { key: "customer", label: "Customer" },
    { key: "cratesDispatched", label: "Dispatched" },
    { key: "cratesReturned", label: "Returned" },
    { key: "cratesDamaged", label: "Damaged" },
    { key: "cratesMissing", label: "Missing" },
    { key: "pendingBalance", label: "Pending" },
  ],
  fuel: [
    { key: "date", label: "Date" },
    { key: "vehicle", label: "Vehicle" },
    { key: "driver", label: "Driver" },
    { key: "distanceKm", label: "Distance (KM)" },
    { key: "fuelQuantityLiters", label: "Fuel Qty (L)" },
    { key: "totalFuelCost", label: "Total Cost" },
    { key: "mileageKmpl", label: "Mileage (KM/L)" },
    { key: "fuelCostPerKm", label: "Cost/KM" },
    { key: "anomaly", label: "Anomaly" },
  ],
  maintenance: [
    { key: "serviceDate", label: "Service Date" },
    { key: "vehicle", label: "Vehicle" },
    { key: "maintenanceType", label: "Type" },
    { key: "serviceCenterVendor", label: "Service Center" },
    { key: "totalCost", label: "Total Cost" },
    { key: "vehicleMaintenanceState", label: "Schedule Status" },
    { key: "nextServiceDate", label: "Next Service Date" },
  ],
  "payroll-summary": [
    { key: "personName", label: "Name" },
    { key: "period", label: "Period" },
    { key: "earnings", label: "Earnings" },
    { key: "overtimeAmount", label: "Overtime Amount" },
    { key: "advances", label: "Advances" },
    { key: "deductions", label: "Deductions" },
    { key: "netSalary", label: "Net Salary" },
    { key: "paymentStatus", label: "Payment Status" },
  ],
  "audit-log": [
    { key: "createdAt", label: "Date/Time" },
    { key: "user", label: "User" },
    { key: "action", label: "Action" },
    { key: "entityType", label: "Entity Type" },
    { key: "entityId", label: "Entity ID" },
    { key: "ipAddress", label: "IP Address" },
  ],
};

export interface ReportFilterConfig {
  q?: boolean;
  dateRange?: boolean;
  warehouse?: boolean;
  category?: boolean;
  supplier?: boolean;
  item?: boolean;
  customer?: boolean;
  status?: string[];
  ledgerType?: boolean;
  windowDays?: boolean;
  auditUser?: boolean;
  auditAction?: boolean;
  auditEntityType?: boolean;
}

export const REPORT_FILTER_CONFIG: Record<ReportType, ReportFilterConfig> = {
  "current-stock": { warehouse: true, category: true, q: true },
  "stock-ledger": { q: true, item: true, warehouse: true, ledgerType: true, dateRange: true },
  inward: { q: true, status: ["DRAFT", "PENDING", "APPROVED", "RECEIVED", "CANCELLED"], dateRange: true },
  outward: { q: true, status: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "ISSUED", "REJECTED", "CANCELLED"], dateRange: true },
  transfer: { q: true, status: ["DRAFT", "REQUESTED", "APPROVED", "DISPATCHED", "RECEIVED", "REJECTED", "CANCELLED"], dateRange: true },
  adjustment: { q: true, status: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"], dateRange: true },
  "warehouse-stock": { warehouse: true, q: true },
  "item-wise": { warehouse: true, category: true, dateRange: true, q: true },
  "category-wise": { q: true },
  "supplier-wise": { q: true },
  "date-wise": { dateRange: true },
  "low-stock": { warehouse: true, category: true, q: true },
  "out-of-stock": { warehouse: true, category: true, q: true },
  "damaged-stock": { warehouse: true, item: true, dateRange: true, q: true },
  "expired-stock": { item: true, q: true },
  "vehicle-entry-exit": { status: ["INSIDE", "OUT"], dateRange: true, q: true },
  "driver-list": { status: ["ACTIVE", "INACTIVE", "ON_LEAVE"], q: true },
  "vehicle-list": { status: ["AVAILABLE", "INSIDE", "OUTSIDE", "ON_TRIP", "MAINTENANCE", "INACTIVE"], q: true },
  "driver-document-expiry": { windowDays: true, q: true },
  "vehicle-document-expiry": { windowDays: true, q: true },
  "purchase-order": {
    q: true,
    supplier: true,
    status: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
    dateRange: true,
  },
  procurement: {
    q: true,
    status: ["DRAFT", "SUBMITTED", "CANCELLED"],
    supplier: true,
    dateRange: true,
  },
  "procurement-batch": {
    q: true,
    status: ["PENDING_UNLOADING", "PENDING_SORTING", "SORTED", "CLOSED"],
    item: true,
    supplier: true,
    dateRange: true,
  },
  "vendor-wise-procurement": { q: true },
  "sorting-yield": { item: true, dateRange: true, q: true },
  wastage: { status: ["SORTING", "WAREHOUSE"], item: true, dateRange: true, q: true },
  "sales-order": {
    q: true,
    status: ["DRAFT", "PENDING", "APPROVED", "READY_FOR_DISPATCH", "PARTIALLY_FULFILLED", "COMPLETED", "CANCELLED"],
    customer: true,
    dateRange: true,
  },
  "customer-wise-sales": { q: true },
  trip: {
    q: true,
    status: ["CREATED", "APPROVED", "LOADING", "LOADED", "DISPATCHED", "DELIVERED", "RETURNED", "CANCELLED"],
    dateRange: true,
  },
  "crate-status": { q: true, status: ["AVAILABLE", "LOADED", "WITH_CUSTOMER", "RETURNED", "DAMAGED", "MISSING", "CLEANING", "READY"] },
  "crate-overdue": { q: true },
  "crate-customer-balance": { customer: true, q: true },
  fuel: { status: ["NORMAL", "ANOMALY"], dateRange: true, q: true },
  maintenance: { status: ["UP_TO_DATE", "DUE_SOON", "DUE", "OVERDUE"], dateRange: true, q: true },
  "payroll-summary": { status: ["PENDING", "PAID"], dateRange: true, q: true },
  "audit-log": { q: true, auditUser: true, auditAction: true, auditEntityType: true, dateRange: true },
};

// ==================================================
// Per-report queries
// ==================================================

async function getCurrentStockReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.ItemWhereInput = { isActive: true };
  // With a warehouse chosen, list stock held in that warehouse rather than items whose home it is.
  if (filters.warehouseId) where.warehouseStocks = { some: { warehouseId: filters.warehouseId, quantity: { not: 0 } } };
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { sku: { contains: filters.q, mode: "insensitive" } },
      { itemCode: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  const [total, items, warehouse] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      include: {
        category: true,
        warehouse: true,
        warehouseStocks: filters.warehouseId ? { where: { warehouseId: filters.warehouseId } } : false,
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    filters.warehouseId ? prisma.warehouse.findUnique({ where: { id: filters.warehouseId } }) : null,
  ]);
  const rows = items.map((i) => ({
    id: i.id,
    itemCode: i.itemCode,
    name: i.name,
    sku: i.sku,
    category: i.category.name,
    warehouse: warehouse ? warehouse.name : (i.warehouse?.name ?? "—"),
    unit: i.unit,
    currentStock: warehouse ? num(i.warehouseStocks[0]?.quantity) : num(i.currentStock),
    minStock: num(i.minStock),
    reorderLevel: num(i.reorderLevel),
  }));
  return { rows, total, page, pageSize };
}

async function getStockLedgerReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.InventoryLedgerWhereInput = {};
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.ledgerType) where.transactionType = filters.ledgerType as Prisma.InventoryLedgerWhereInput["transactionType"];
  if (filters.q) {
    where.OR = [
      { item: { name: ci(filters.q) } },
      { item: { sku: ci(filters.q) } },
      { referenceNumber: ci(filters.q) },
    ];
  }
  const dateRange = parseDateRange(filters);
  if (dateRange) where.createdAt = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.inventoryLedger.count({ where }),
    prisma.inventoryLedger.findMany({
      where,
      include: { item: true, warehouse: true, user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    item: r.item.name,
    sku: r.item.sku,
    warehouse: r.warehouse.name,
    type: r.transactionType,
    quantity: num(r.quantity),
    beforeQty: num(r.beforeQty),
    afterQty: num(r.afterQty),
    referenceNumber: r.referenceNumber,
    referenceType: r.referenceType,
    user: r.user.name,
    reason: r.reason,
  }));
  return { rows, total, page, pageSize };
}

async function getInwardReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.StockInwardWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.StockInwardWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { inwardNumber: ci(filters.q) },
      { supplier: { companyName: ci(filters.q) } },
      { items: { some: { item: { name: ci(filters.q) } } } },
    ];
  }
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.stockInward.count({ where }),
    prisma.stockInward.findMany({
      where,
      include: { supplier: true, warehouse: true, receivedBy: true, _count: { select: { items: true } } },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    inwardNumber: r.inwardNumber,
    date: r.date,
    supplier: r.supplier?.companyName ?? "—",
    warehouse: r.warehouse.name,
    receivedBy: r.receivedBy.name,
    itemCount: r._count.items,
    status: r.status,
  }));
  return { rows, total, page, pageSize };
}

async function getOutwardReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.StockOutwardWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.StockOutwardWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { outwardNumber: ci(filters.q) },
      { destination: ci(filters.q) },
      { items: { some: { item: { name: ci(filters.q) } } } },
    ];
  }
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.stockOutward.count({ where }),
    prisma.stockOutward.findMany({
      where,
      include: { warehouse: true, requestedBy: true, _count: { select: { items: true } } },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    outwardNumber: r.outwardNumber,
    date: r.date,
    warehouse: r.warehouse.name,
    requestedBy: r.requestedBy.name,
    destination: r.destination ?? "—",
    itemCount: r._count.items,
    status: r.status,
  }));
  return { rows, total, page, pageSize };
}

async function getTransferReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.StockTransferWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.StockTransferWhereInput["status"];
  const transferAnd: Prisma.StockTransferWhereInput[] = [];
  if (filters.warehouseId) {
    transferAnd.push({ OR: [{ sourceWarehouseId: filters.warehouseId }, { destWarehouseId: filters.warehouseId }] });
  }
  if (filters.q) {
    transferAnd.push({
      OR: [{ transferNumber: ci(filters.q) }, { items: { some: { item: { name: ci(filters.q) } } } }],
    });
  }
  if (transferAnd.length) where.AND = transferAnd;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.createdAt = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.stockTransfer.count({ where }),
    prisma.stockTransfer.findMany({
      where,
      include: { sourceWarehouse: true, destWarehouse: true, requestedBy: true, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    transferNumber: r.transferNumber,
    sourceWarehouse: r.sourceWarehouse.name,
    destWarehouse: r.destWarehouse.name,
    requestedBy: r.requestedBy.name,
    itemCount: r._count.items,
    status: r.status,
  }));
  return { rows, total, page, pageSize };
}

async function getAdjustmentReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.StockAdjustmentWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.StockAdjustmentWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { adjustmentNumber: ci(filters.q) },
      { item: { name: ci(filters.q) } },
      { item: { sku: ci(filters.q) } },
    ];
  }
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.itemId) where.itemId = filters.itemId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.createdAt = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.stockAdjustment.count({ where }),
    prisma.stockAdjustment.findMany({
      where,
      include: { item: true, warehouse: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    adjustmentNumber: r.adjustmentNumber,
    item: r.item.name,
    warehouse: r.warehouse.name,
    currentQty: num(r.currentQty),
    physicalQty: num(r.physicalQty),
    difference: num(r.difference),
    reason: r.reason,
    status: r.status,
  }));
  return { rows, total, page, pageSize };
}

async function getWarehouseStockReport(filters: ReportFilters): Promise<ReportResult> {
  // Stock actually held in each warehouse (per-warehouse balances), not grouped by items' home warehouse.
  const grouped = await prisma.itemWarehouseStock.groupBy({
    by: ["warehouseId"],
    where: { quantity: { not: 0 }, item: { isActive: true } },
    _sum: { quantity: true },
    _count: { _all: true },
  });
  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: grouped.map((g) => g.warehouseId) } },
  });
  const rows = grouped
    .map((g) => ({
      warehouseId: g.warehouseId,
      warehouse: warehouses.find((w) => w.id === g.warehouseId)?.name ?? "Unknown",
      itemCount: g._count._all,
      totalStock: num(g._sum.quantity),
    }))
    .filter((r) => matchesQuery(filters.q, r.warehouse))
    .sort((a, b) => b.totalStock - a.totalStock);

  // With a warehouse chosen, the report lists that warehouse's items instead of the per-warehouse summary.
  if (filters.warehouseId) {
    const itemWhere: Prisma.ItemWhereInput = { isActive: true };
    if (filters.q) itemWhere.OR = [{ name: ci(filters.q) }, { sku: ci(filters.q) }, { itemCode: ci(filters.q) }];
    const stocks = await prisma.itemWarehouseStock.findMany({
      where: { warehouseId: filters.warehouseId, quantity: { not: 0 }, item: itemWhere },
      include: { item: { include: { category: true } } },
      orderBy: { item: { name: "asc" } },
    });
    const itemRows = stocks.map((s) => ({
      id: s.item.id,
      name: s.item.name,
      sku: s.item.sku,
      category: s.item.category.name,
      currentStock: num(s.quantity),
      unit: s.item.unit,
    }));
    return {
      ...paginateRows(itemRows, filters),
      columns: [
        { key: "name", label: "Item" },
        { key: "sku", label: "SKU" },
        { key: "category", label: "Category" },
        { key: "currentStock", label: "Stock in Warehouse" },
        { key: "unit", label: "Unit" },
      ],
    };
  }

  return paginateRows(rows, filters);
}

async function getItemWiseReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const dateRange = parseDateRange(filters) ?? { gte: new Date(Date.now() - 30 * 86400000) };
  const where: Prisma.ItemWhereInput = { isActive: true };
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.warehouseId) where.warehouseStocks = { some: { warehouseId: filters.warehouseId, quantity: { not: 0 } } };
  if (filters.q) where.OR = [{ name: ci(filters.q) }, { sku: ci(filters.q) }, { itemCode: ci(filters.q) }];
  const [total, items, warehouse] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      include: {
        category: true,
        warehouse: true,
        warehouseStocks: filters.warehouseId ? { where: { warehouseId: filters.warehouseId } } : false,
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    filters.warehouseId ? prisma.warehouse.findUnique({ where: { id: filters.warehouseId } }) : null,
  ]);
  const itemIds = items.map((i) => i.id);
  // With a warehouse chosen, stock and movement figures are that warehouse's own.
  const ledgerAgg = itemIds.length
    ? await prisma.inventoryLedger.groupBy({
        by: ["itemId", "transactionType"],
        where: {
          itemId: { in: itemIds },
          createdAt: dateRange,
          ...(filters.warehouseId ? { warehouseId: filters.warehouseId } : {}),
        },
        _sum: { quantity: true },
      })
    : [];
  const rows = items.map((i) => {
    const inwardQty = ledgerAgg
      .filter((l) => l.itemId === i.id && l.transactionType === "INWARD")
      .reduce((s, l) => s + num(l._sum.quantity), 0);
    const outwardQty = ledgerAgg
      .filter((l) => l.itemId === i.id && l.transactionType === "OUTWARD")
      .reduce((s, l) => s + num(l._sum.quantity), 0);
    return {
      id: i.id,
      name: i.name,
      sku: i.sku,
      category: i.category.name,
      warehouse: warehouse ? warehouse.name : (i.warehouse?.name ?? "—"),
      currentStock: warehouse ? num(i.warehouseStocks[0]?.quantity) : num(i.currentStock),
      inwardQty,
      outwardQty,
    };
  });
  return { rows, total, page, pageSize };
}

async function getCategoryWiseReport(filters: ReportFilters): Promise<ReportResult> {
  const grouped = await prisma.item.groupBy({
    by: ["categoryId"],
    where: { isActive: true },
    _sum: { currentStock: true },
    _count: { _all: true },
  });
  const categories = await prisma.category.findMany({ where: { id: { in: grouped.map((g) => g.categoryId) } } });
  const rows = grouped
    .map((g) => ({
      categoryId: g.categoryId,
      category: categories.find((c) => c.id === g.categoryId)?.name ?? "Unknown",
      itemCount: g._count._all,
      totalStock: num(g._sum.currentStock),
    }))
    .filter((r) => matchesQuery(filters.q, r.category))
    .sort((a, b) => b.totalStock - a.totalStock);
  return paginateRows(rows, filters);
}

async function getSupplierWiseReport(filters: ReportFilters): Promise<ReportResult> {
  const grouped = await prisma.item.groupBy({
    by: ["supplierId"],
    where: { isActive: true, supplierId: { not: null } },
    _sum: { currentStock: true },
    _count: { _all: true },
  });
  const supplierIds = grouped.map((g) => g.supplierId!).filter(Boolean);
  const [suppliers, poTotals] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: supplierIds } } }),
    supplierIds.length
      ? prisma.purchaseOrder.groupBy({ by: ["supplierId"], where: { supplierId: { in: supplierIds } }, _sum: { totalAmount: true } })
      : Promise.resolve([]),
  ]);
  const rows = grouped
    .map((g) => ({
      supplierId: g.supplierId,
      supplier: suppliers.find((s) => s.id === g.supplierId)?.companyName ?? "Unknown",
      itemCount: g._count._all,
      totalStock: num(g._sum.currentStock),
      totalPOAmount: num(poTotals.find((p) => p.supplierId === g.supplierId)?._sum.totalAmount ?? null),
    }))
    .filter((r) => matchesQuery(filters.q, r.supplier))
    .sort((a, b) => b.totalStock - a.totalStock);
  return paginateRows(rows, filters);
}

async function getDateWiseReport(filters: ReportFilters): Promise<ReportResult> {
  const from = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000`) : new Date(Date.now() - 13 * 86400000);
  const to = filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999`) : new Date();
  const rowsRaw = await prisma.inventoryLedger.findMany({
    where: { createdAt: { gte: from, lte: to }, transactionType: { in: ["INWARD", "OUTWARD"] } },
    select: { createdAt: true, transactionType: true, quantity: true },
  });
  const map = new Map<string, { inward: number; outward: number }>();
  for (const r of rowsRaw) {
    const key = format(r.createdAt, "yyyy-MM-dd"); // local day, matching the rest of the app
    const entry = map.get(key) ?? { inward: 0, outward: 0 };
    if (r.transactionType === "INWARD") entry.inward += num(r.quantity);
    else entry.outward += num(r.quantity);
    map.set(key, entry);
  }
  const rows = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, inwardQty: v.inward, outwardQty: v.outward }));
  return paginateRows(rows, filters);
}

async function getLowStockReport(filters: ReportFilters): Promise<ReportResult> {
  const conditions = [Prisma.sql`i."isActive" = true`, Prisma.sql`i."currentStock" <= i."reorderLevel"`];
  if (filters.warehouseId) conditions.push(Prisma.sql`i."warehouseId" = ${filters.warehouseId}`);
  if (filters.categoryId) conditions.push(Prisma.sql`i."categoryId" = ${filters.categoryId}`);
  if (filters.q) {
    const pattern = likePattern(filters.q);
    conditions.push(Prisma.sql`(i.name ILIKE ${pattern} OR i.sku ILIKE ${pattern} OR i."itemCode" ILIKE ${pattern})`);
  }
  const whereSql = Prisma.join(conditions, " AND ");
  const raw = await prisma.$queryRaw<
    {
      id: string;
      itemCode: string;
      name: string;
      sku: string;
      unit: string;
      currentStock: Prisma.Decimal;
      reorderLevel: Prisma.Decimal;
      warehouseName: string | null;
      categoryName: string;
    }[]
  >(Prisma.sql`
    SELECT i.id, i."itemCode", i.name, i.sku, i.unit, i."currentStock", i."reorderLevel",
           w.name AS "warehouseName", c.name AS "categoryName"
    FROM "Item" i
    LEFT JOIN "Warehouse" w ON w.id = i."warehouseId"
    JOIN "Category" c ON c.id = i."categoryId"
    WHERE ${whereSql}
    ORDER BY (i."currentStock" - i."reorderLevel") ASC
  `);
  const rows = raw.map((r) => ({ ...r, currentStock: num(r.currentStock), reorderLevel: num(r.reorderLevel) }));
  return paginateRows(rows, filters);
}

async function getOutOfStockReport(filters: ReportFilters): Promise<ReportResult> {
  const where: Prisma.ItemWhereInput = { isActive: true, currentStock: { lte: 0 } };
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.q) where.OR = [{ name: ci(filters.q) }, { sku: ci(filters.q) }, { itemCode: ci(filters.q) }];
  const { page, pageSize, skip, take } = parsePage(filters);
  const [total, items] = await Promise.all([
    prisma.item.count({ where }),
    prisma.item.findMany({
      where,
      include: { category: true, warehouse: true },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
  ]);
  const rows = items.map((i) => ({
    id: i.id,
    itemCode: i.itemCode,
    name: i.name,
    category: i.category.name,
    warehouse: i.warehouse?.name ?? "—",
    currentStock: num(i.currentStock),
    reorderLevel: num(i.reorderLevel),
    unit: i.unit,
  }));
  return { rows, total, page, pageSize };
}

async function getDamagedStockReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.InventoryLedgerWhereInput = { transactionType: "DAMAGED_DISPOSED" };
  if (filters.q) {
    where.OR = [
      { item: { name: ci(filters.q) } },
      { item: { sku: ci(filters.q) } },
      { referenceNumber: ci(filters.q) },
    ];
  }
  const dateRange = parseDateRange(filters);
  if (dateRange) where.createdAt = dateRange;
  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.itemId) where.itemId = filters.itemId;
  const [total, rows0] = await Promise.all([
    prisma.inventoryLedger.count({ where }),
    prisma.inventoryLedger.findMany({
      where,
      include: { item: true, warehouse: true, user: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    item: r.item.name,
    sku: r.item.sku,
    warehouse: r.warehouse.name,
    quantity: num(r.quantity),
    reason: r.reason ?? "—",
    referenceNumber: r.referenceNumber,
    user: r.user.name,
  }));
  return { rows, total, page, pageSize };
}

async function getExpiredStockReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.StockInwardItemWhereInput = { expiryDate: { lt: new Date() } };
  if (filters.q) {
    where.OR = [
      { item: { name: ci(filters.q) } },
      { item: { sku: ci(filters.q) } },
      { batchNumber: ci(filters.q) },
      { inward: { inwardNumber: ci(filters.q) } },
    ];
  }
  if (filters.itemId) where.itemId = filters.itemId;
  const [total, rows0] = await Promise.all([
    prisma.stockInwardItem.count({ where }),
    prisma.stockInwardItem.findMany({
      where,
      include: { item: { include: { category: true } }, inward: { include: { warehouse: true } } },
      orderBy: { expiryDate: "asc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    item: r.item.name,
    sku: r.item.sku,
    category: r.item.category.name,
    warehouse: r.inward.warehouse.name,
    batchNumber: r.batchNumber ?? "—",
    quantity: num(r.quantity),
    unit: r.unit,
    expiryDate: r.expiryDate,
    inwardNumber: r.inward.inwardNumber,
  }));
  return { rows, total, page, pageSize };
}

async function getVehicleEntryExitReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.VehicleGateEntryWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.VehicleGateEntryWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { gateEntryNumber: ci(filters.q) },
      { vehicle: { vehicleNumber: ci(filters.q) } },
      { driver: { fullName: ci(filters.q) } },
      { supplier: { companyName: ci(filters.q) } },
    ];
  }
  const dateRange = parseDateRange(filters);
  if (dateRange) where.timeIn = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.vehicleGateEntry.count({ where }),
    prisma.vehicleGateEntry.findMany({
      where,
      include: { vehicle: true, driver: true, supplier: true, exit: true },
      orderBy: { timeIn: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((r) => ({
    id: r.id,
    gateEntryNumber: r.gateEntryNumber,
    vehicle: r.vehicle.vehicleNumber,
    driver: r.driver.fullName,
    supplier: r.supplier?.companyName ?? "—",
    purpose: r.purpose ?? "—",
    timeIn: r.timeIn,
    timeOut: r.exit?.timeOut ?? null,
    status: r.status,
  }));
  return { rows, total, page, pageSize };
}

async function getDriverListReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.DriverWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.DriverWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { fullName: { contains: filters.q, mode: "insensitive" } },
      { mobile: { contains: filters.q, mode: "insensitive" } },
    ];
  }
  const [total, rows0] = await Promise.all([
    prisma.driver.count({ where }),
    prisma.driver.findMany({ where, orderBy: { fullName: "asc" }, skip, take }),
  ]);
  const rows = rows0.map((d) => ({
    id: d.id,
    employeeId: d.employeeId ?? "—",
    fullName: d.fullName,
    mobile: d.mobile,
    status: d.status,
    joiningDate: d.joiningDate,
  }));
  return { rows, total, page, pageSize };
}

async function getVehicleListReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.VehicleWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.VehicleWhereInput["status"];
  if (filters.q) where.vehicleNumber = { contains: filters.q, mode: "insensitive" };
  const [total, rows0] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({ where, include: { currentDriver: true }, orderBy: { vehicleNumber: "asc" }, skip, take }),
  ]);
  const rows = rows0.map((v) => ({
    id: v.id,
    vehicleNumber: v.vehicleNumber,
    vehicleType: v.vehicleType,
    currentDriver: v.currentDriver?.fullName ?? "—",
    status: v.status,
    maintenanceState: v.maintenanceState,
  }));
  return { rows, total, page, pageSize };
}

type ExpiryBucket = "Expired" | "Expires in 7 days" | "Expires in 15 days" | "Expires in 30 days" | "Expires in 60 days";

function bucketFor(expiryDate: Date, now: Date, windowDays: number): ExpiryBucket | null {
  const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return "Expired";
  if (diffDays <= 7) return "Expires in 7 days";
  if (diffDays <= 15) return "Expires in 15 days";
  if (diffDays <= 30) return "Expires in 30 days";
  if (diffDays <= 60 && windowDays >= 60) return "Expires in 60 days";
  if (diffDays <= windowDays) return "Expires in 60 days";
  return null;
}

async function getDriverDocumentExpiryReport(filters: ReportFilters): Promise<ReportResult> {
  const windowDays = Math.min(365, Math.max(1, Number(filters.windowDays) || 30));
  const now = new Date();
  const horizon = new Date(now.getTime() + Math.max(windowDays, 60) * 86400000);
  const docs = await prisma.driverDocument.findMany({
    where: { expiryDate: { lte: horizon }, ...(filters.q ? { driver: { fullName: ci(filters.q) } } : {}) },
    include: { driver: true },
    orderBy: { expiryDate: "asc" },
  });
  const rows = docs
    .filter((d) => d.expiryDate)
    .map((d) => ({
      id: d.id,
      driver: d.driver.fullName,
      docType: d.docType,
      expiryDate: d.expiryDate!,
      verificationStatus: d.verificationStatus,
      bucket: bucketFor(d.expiryDate!, now, windowDays),
    }))
    .filter((r) => r.bucket !== null);
  return paginateRows(rows, filters);
}

async function getVehicleDocumentExpiryReport(filters: ReportFilters): Promise<ReportResult> {
  const windowDays = Math.min(365, Math.max(1, Number(filters.windowDays) || 30));
  const now = new Date();
  const horizon = new Date(now.getTime() + Math.max(windowDays, 60) * 86400000);
  const docs = await prisma.vehicleDocument.findMany({
    where: { expiryDate: { lte: horizon }, ...(filters.q ? { vehicle: { vehicleNumber: ci(filters.q) } } : {}) },
    include: { vehicle: true },
    orderBy: { expiryDate: "asc" },
  });
  const rows = docs
    .filter((d) => d.expiryDate)
    .map((d) => ({
      id: d.id,
      vehicle: d.vehicle.vehicleNumber,
      docType: d.docType,
      expiryDate: d.expiryDate!,
      verificationStatus: d.verificationStatus,
      bucket: bucketFor(d.expiryDate!, now, windowDays),
    }))
    .filter((r) => r.bucket !== null);
  return paginateRows(rows, filters);
}

async function getPurchaseOrderReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.PurchaseOrderWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.PurchaseOrderWhereInput["status"];
  if (filters.q) where.OR = [{ poNumber: ci(filters.q) }, { supplier: { companyName: ci(filters.q) } }];
  if (filters.supplierId) where.supplierId = filters.supplierId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({
      where,
      include: { supplier: true, _count: { select: { items: true } } },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((p) => ({
    id: p.id,
    poNumber: p.poNumber,
    supplier: p.supplier.companyName,
    date: p.date,
    itemCount: p._count.items,
    totalAmount: num(p.totalAmount),
    status: p.status,
  }));
  return { rows, total, page, pageSize };
}

async function getProcurementReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.ProcurementWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.ProcurementWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { procurementNumber: ci(filters.q) },
      { supplier: { companyName: ci(filters.q) } },
      { vehicle: { vehicleNumber: ci(filters.q) } },
    ];
  }
  if (filters.supplierId) where.supplierId = filters.supplierId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.procurement.count({ where }),
    prisma.procurement.findMany({
      where,
      include: { supplier: true, vehicle: true, warehouse: true, _count: { select: { items: true } } },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((p) => ({
    id: p.id,
    procurementNumber: p.procurementNumber,
    date: p.date,
    supplier: p.supplier.companyName,
    vehicle: p.vehicle?.vehicleNumber ?? "—",
    warehouse: p.warehouse.name,
    itemCount: p._count.items,
    status: p.status,
  }));
  return { rows, total, page, pageSize };
}

async function getProcurementBatchReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.ProcurementBatchWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.ProcurementBatchWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { batchNumber: ci(filters.q) },
      { item: { name: ci(filters.q) } },
      { supplier: { companyName: ci(filters.q) } },
    ];
  }
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.procurementBatch.count({ where }),
    prisma.procurementBatch.findMany({
      where,
      include: { item: true, supplier: true },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((b) => ({
    id: b.id,
    batchNumber: b.batchNumber,
    item: b.item.name,
    supplier: b.supplier.companyName,
    rawWeight: num(b.rawWeight),
    status: b.status,
    date: b.date,
  }));
  return { rows, total, page, pageSize };
}

async function getVendorWiseProcurementReport(filters: ReportFilters): Promise<ReportResult> {
  const grouped = await prisma.procurementBatch.groupBy({
    by: ["supplierId"],
    _sum: { rawWeight: true },
    _count: { _all: true },
  });
  const supplierIds = grouped.map((g) => g.supplierId);
  const [suppliers, wastageRows] = await Promise.all([
    prisma.supplier.findMany({ where: { id: { in: supplierIds } } }),
    supplierIds.length
      ? prisma.wastage.findMany({
          where: { batch: { supplierId: { in: supplierIds } } },
          select: { quantity: true, batch: { select: { supplierId: true } } },
        })
      : Promise.resolve([]),
  ]);
  const wastageBySupplier = new Map<string, number>();
  for (const w of wastageRows) {
    const supplierId = w.batch?.supplierId;
    if (!supplierId) continue;
    wastageBySupplier.set(supplierId, (wastageBySupplier.get(supplierId) ?? 0) + num(w.quantity));
  }
  const rows = grouped
    .map((g) => ({
      supplierId: g.supplierId,
      supplier: suppliers.find((s) => s.id === g.supplierId)?.companyName ?? "Unknown",
      batchCount: g._count._all,
      totalRawWeight: num(g._sum.rawWeight),
      totalWastage: wastageBySupplier.get(g.supplierId) ?? 0,
    }))
    .filter((r) => matchesQuery(filters.q, r.supplier))
    .sort((a, b) => b.totalRawWeight - a.totalRawWeight);
  return paginateRows(rows, filters);
}

async function getSortingYieldReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.SortingWhereInput = {};
  if (filters.itemId) where.batch = { itemId: filters.itemId };
  if (filters.q) {
    where.AND = [{ OR: [{ batch: { batchNumber: ci(filters.q) } }, { batch: { item: { name: ci(filters.q) } } }] }];
  }
  const dateRange = parseDateRange(filters);
  if (dateRange) where.sortedAt = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.sorting.count({ where }),
    prisma.sorting.findMany({
      where,
      include: { batch: { include: { item: true } } },
      orderBy: { sortedAt: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((s) => {
    const rawWeight = num(s.rawWeight);
    const wasteWeight = num(s.wasteWeight);
    const yieldPercent = rawWeight > 0 ? ((rawWeight - wasteWeight) / rawWeight) * 100 : 0;
    return {
      id: s.id,
      batch: s.batch.batchNumber,
      item: s.batch.item.name,
      rawWeight,
      gradeAWeight: num(s.gradeAWeight),
      gradeBWeight: num(s.gradeBWeight),
      gradeCWeight: num(s.gradeCWeight),
      otherGradeWeight: num(s.otherGradeWeight),
      wasteWeight,
      yieldPercent: Math.round(yieldPercent * 100) / 100,
    };
  });
  return { rows, total, page, pageSize };
}

async function getWastageReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.WastageWhereInput = {};
  if (filters.status) where.stage = filters.status as Prisma.WastageWhereInput["stage"];
  if (filters.q) where.OR = [{ wastageNumber: ci(filters.q) }, { item: { name: ci(filters.q) } }];
  if (filters.itemId) where.itemId = filters.itemId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.wastage.count({ where }),
    prisma.wastage.findMany({
      where,
      include: { item: true, recordedBy: true },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((w) => ({
    id: w.id,
    wastageNumber: w.wastageNumber,
    item: w.item.name,
    stage: w.stage,
    quantity: num(w.quantity),
    reason: w.reason,
    date: w.date,
    recordedBy: w.recordedBy.name,
  }));
  return { rows, total, page, pageSize };
}

async function getSalesOrderReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.SalesOrderWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.SalesOrderWhereInput["status"];
  if (filters.q) where.OR = [{ soNumber: ci(filters.q) }, { customer: { name: ci(filters.q) } }];
  if (filters.customerId) where.customerId = filters.customerId;
  const dateRange = parseDateRange(filters);
  if (dateRange) where.orderDate = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.salesOrder.count({ where }),
    prisma.salesOrder.findMany({
      where,
      include: { customer: true, _count: { select: { items: true } } },
      orderBy: { orderDate: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((s) => ({
    id: s.id,
    soNumber: s.soNumber,
    customer: s.customer.name,
    orderDate: s.orderDate,
    itemCount: s._count.items,
    totalAmount: num(s.totalAmount),
    status: s.status,
  }));
  return { rows, total, page, pageSize };
}

async function getCustomerWiseSalesReport(filters: ReportFilters): Promise<ReportResult> {
  const grouped = await prisma.salesOrder.groupBy({
    by: ["customerId"],
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  const customerIds = grouped.map((g) => g.customerId);
  const [customers, itemRows] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } } }),
    customerIds.length
      ? prisma.salesOrderItem.findMany({
          where: { salesOrder: { customerId: { in: customerIds } } },
          select: { quantity: true, salesOrder: { select: { customerId: true } } },
        })
      : Promise.resolve([]),
  ]);
  const quantityByCustomer = new Map<string, number>();
  for (const item of itemRows) {
    const customerId = item.salesOrder.customerId;
    quantityByCustomer.set(customerId, (quantityByCustomer.get(customerId) ?? 0) + num(item.quantity));
  }
  const rows = grouped
    .map((g) => ({
      customerId: g.customerId,
      customer: customers.find((c) => c.id === g.customerId)?.name ?? "Unknown",
      orderCount: g._count._all,
      totalQuantity: quantityByCustomer.get(g.customerId) ?? 0,
      totalAmount: num(g._sum.totalAmount),
    }))
    .filter((r) => matchesQuery(filters.q, r.customer))
    .sort((a, b) => b.totalAmount - a.totalAmount);
  return paginateRows(rows, filters);
}

async function getTripReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.TripWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.TripWhereInput["status"];
  if (filters.q) {
    where.OR = [
      { tripNumber: ci(filters.q) },
      { customer: { name: ci(filters.q) } },
      { vehicle: { vehicleNumber: ci(filters.q) } },
      { driver: { fullName: ci(filters.q) } },
    ];
  }
  const dateRange = parseDateRange(filters);
  if (dateRange) where.departureAt = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      include: { customer: true, vehicle: true, driver: true, route: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((t) => ({
    id: t.id,
    tripNumber: t.tripNumber,
    customer: t.customer.name,
    vehicle: t.vehicle.vehicleNumber,
    driver: t.driver.fullName,
    route: t.route?.name ?? "—",
    status: t.status,
    departureAt: t.departureAt,
  }));
  return { rows, total, page, pageSize };
}

async function getCrateStatusReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.CrateWhereInput = {};
  if (filters.status) where.status = filters.status as Prisma.CrateWhereInput["status"];
  if (filters.q) where.OR = [{ crateCode: ci(filters.q) }, { currentLocation: ci(filters.q) }];
  const [total, rows0] = await Promise.all([
    prisma.crate.count({ where }),
    prisma.crate.findMany({ where, orderBy: { crateCode: "asc" }, skip, take }),
  ]);
  const rows = rows0.map((c) => ({
    id: c.id,
    crateCode: c.crateCode,
    crateType: c.crateType,
    status: c.status,
    currentLocation: c.currentLocation ?? "—",
  }));
  return { rows, total, page, pageSize };
}

async function getPayrollSummaryReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.SalaryWhereInput = {};
  if (filters.status) where.paymentStatus = filters.status as Prisma.SalaryWhereInput["paymentStatus"];
  if (filters.q) where.OR = [{ employee: { name: ci(filters.q) } }, { labour: { name: ci(filters.q) } }];
  const dateRange = parseDateRange(filters);
  if (dateRange) where.periodStart = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.salary.count({ where }),
    prisma.salary.findMany({
      where,
      include: { employee: true, labour: true },
      orderBy: { periodStart: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((s) => ({
    id: s.id,
    personName: s.employee?.name ?? s.labour?.name ?? "—",
    period: `${format(s.periodStart, "yyyy-MM-dd")} to ${format(s.periodEnd, "yyyy-MM-dd")}`,
    earnings: num(s.earnings),
    overtimeAmount: num(s.overtimeAmount),
    advances: num(s.advances),
    deductions: num(s.deductions),
    netSalary: num(s.netSalary),
    paymentStatus: s.paymentStatus,
  }));
  return { rows, total, page, pageSize };
}

async function getAuditLogReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.userId) where.userId = filters.userId;
  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.q) {
    where.OR = [{ entityId: ci(filters.q) }, { entityType: ci(filters.q) }, { user: { name: ci(filters.q) } }];
  }
  const dateRange = parseDateRange(filters);
  if (dateRange) where.createdAt = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { user: true }, orderBy: { createdAt: "desc" }, skip, take }),
  ]);
  const rows = rows0.map((a) => ({
    id: a.id,
    createdAt: a.createdAt,
    user: a.user?.name ?? "System",
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId ?? "—",
    ipAddress: a.ipAddress ?? "—",
  }));
  return { rows, total, page, pageSize };
}

async function getCrateOverdueReport(filters: ReportFilters): Promise<ReportResult> {
  const overdueDays = await getOverdueDays();
  const threshold = new Date(Date.now() - overdueDays * 86400000);
  const rows0 = await prisma.crate.findMany({
    where: {
      status: "WITH_CUSTOMER",
      updatedAt: { lte: threshold },
      ...(filters.q ? { OR: [{ crateCode: ci(filters.q) }, { customer: { name: ci(filters.q) } }] } : {}),
    },
    include: { customer: true },
    orderBy: { updatedAt: "asc" },
  });
  const rows = rows0.map((c) => ({
    id: c.id,
    crateCode: c.crateCode,
    crateType: c.crateType,
    customer: c.customer?.name ?? "—",
    daysWithCustomer: Math.floor((Date.now() - c.updatedAt.getTime()) / 86400000),
    thresholdDays: overdueDays,
  }));
  return paginateRows(rows, filters);
}

async function getCrateCustomerBalanceReport(filters: ReportFilters): Promise<ReportResult> {
  const where: Prisma.CrateReturnWhereInput = {};
  if (filters.customerId) where.customerId = filters.customerId;
  const grouped = await prisma.crateReturn.groupBy({
    by: ["customerId"],
    where,
    _sum: { cratesDispatched: true, cratesReturned: true, cratesDamaged: true, cratesMissing: true },
  });
  const customers = await prisma.customer.findMany({ where: { id: { in: grouped.map((g) => g.customerId) } } });
  const rows = grouped
    .map((g) => {
      const dispatched = g._sum.cratesDispatched ?? 0;
      const returned = g._sum.cratesReturned ?? 0;
      const damaged = g._sum.cratesDamaged ?? 0;
      const missing = g._sum.cratesMissing ?? 0;
      return {
        customerId: g.customerId,
        customer: customers.find((c) => c.id === g.customerId)?.name ?? "Unknown",
        cratesDispatched: dispatched,
        cratesReturned: returned,
        cratesDamaged: damaged,
        cratesMissing: missing,
        pendingBalance: dispatched - returned - damaged - missing,
      };
    })
    .filter((r) => matchesQuery(filters.q, r.customer))
    .sort((a, b) => b.pendingBalance - a.pendingBalance);
  return paginateRows(rows, filters);
}

async function getFuelReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.FuelEntryWhereInput = { isVoided: false };
  if (filters.status === "ANOMALY") where.isAnomaly = true;
  if (filters.status === "NORMAL") where.isAnomaly = false;
  if (filters.q) where.OR = [{ vehicle: { vehicleNumber: ci(filters.q) } }, { driver: { fullName: ci(filters.q) } }];
  const dateRange = parseDateRange(filters);
  if (dateRange) where.date = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.fuelEntry.count({ where }),
    prisma.fuelEntry.findMany({
      where,
      include: { vehicle: true, driver: true },
      orderBy: { date: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((f) => ({
    id: f.id,
    date: f.date,
    vehicle: f.vehicle.vehicleNumber,
    driver: f.driver?.fullName ?? "—",
    distanceKm: num(f.distanceKm),
    fuelQuantityLiters: num(f.fuelQuantityLiters),
    totalFuelCost: num(f.totalFuelCost),
    mileageKmpl: num(f.mileageKmpl),
    fuelCostPerKm: num(f.fuelCostPerKm),
    anomaly: f.isAnomaly ? "Yes" : "No",
  }));
  return { rows, total, page, pageSize };
}

async function getMaintenanceReport(filters: ReportFilters): Promise<ReportResult> {
  const { page, pageSize, skip, take } = parsePage(filters);
  const where: Prisma.VehicleMaintenanceWhereInput = { isArchived: false };
  if (filters.q) {
    where.OR = [{ vehicle: { vehicleNumber: ci(filters.q) } }, { serviceCenterVendor: ci(filters.q) }];
  }
  if (filters.status) where.vehicle = { maintenanceState: filters.status as Prisma.VehicleWhereInput["maintenanceState"] };
  const dateRange = parseDateRange(filters);
  if (dateRange) where.serviceDate = dateRange;
  const [total, rows0] = await Promise.all([
    prisma.vehicleMaintenance.count({ where }),
    prisma.vehicleMaintenance.findMany({
      where,
      include: { vehicle: true },
      orderBy: { serviceDate: "desc" },
      skip,
      take,
    }),
  ]);
  const rows = rows0.map((m) => ({
    id: m.id,
    serviceDate: m.serviceDate,
    vehicle: m.vehicle.vehicleNumber,
    maintenanceType: m.maintenanceType,
    serviceCenterVendor: m.serviceCenterVendor ?? "—",
    totalCost: num(m.totalCost),
    vehicleMaintenanceState: m.vehicle.maintenanceState,
    nextServiceDate: m.vehicle.nextServiceDate,
  }));
  return { rows, total, page, pageSize };
}

// ==================================================
// Dispatcher
// ==================================================

const isValidDate = (v: string | undefined) => !!v && !Number.isNaN(new Date(`${v}T00:00:00`).getTime());

/** Drops filter values that came from the URL but aren't valid, so a bad link shows unfiltered data instead of crashing. */
function sanitizeFilters(type: ReportType, filters: ReportFilters): ReportFilters {
  const allowedStatuses = REPORT_FILTER_CONFIG[type].status ?? [];
  return {
    ...filters,
    q: normalizeQuery(filters.q),
    status: filters.status && allowedStatuses.includes(filters.status) ? filters.status : undefined,
    ledgerType:
      filters.ledgerType && (Object.values(LedgerTxnType) as string[]).includes(filters.ledgerType)
        ? filters.ledgerType
        : undefined,
    dateFrom: isValidDate(filters.dateFrom) ? filters.dateFrom : undefined,
    dateTo: isValidDate(filters.dateTo) ? filters.dateTo : undefined,
  };
}

export async function getReportRows(type: ReportType, rawFilters: ReportFilters): Promise<ReportResult> {
  const filters = sanitizeFilters(type, rawFilters);
  switch (type) {
    case "current-stock":
      return getCurrentStockReport(filters);
    case "stock-ledger":
      return getStockLedgerReport(filters);
    case "inward":
      return getInwardReport(filters);
    case "outward":
      return getOutwardReport(filters);
    case "transfer":
      return getTransferReport(filters);
    case "adjustment":
      return getAdjustmentReport(filters);
    case "warehouse-stock":
      return getWarehouseStockReport(filters);
    case "item-wise":
      return getItemWiseReport(filters);
    case "category-wise":
      return getCategoryWiseReport(filters);
    case "supplier-wise":
      return getSupplierWiseReport(filters);
    case "date-wise":
      return getDateWiseReport(filters);
    case "low-stock":
      return getLowStockReport(filters);
    case "out-of-stock":
      return getOutOfStockReport(filters);
    case "damaged-stock":
      return getDamagedStockReport(filters);
    case "expired-stock":
      return getExpiredStockReport(filters);
    case "vehicle-entry-exit":
      return getVehicleEntryExitReport(filters);
    case "driver-list":
      return getDriverListReport(filters);
    case "vehicle-list":
      return getVehicleListReport(filters);
    case "driver-document-expiry":
      return getDriverDocumentExpiryReport(filters);
    case "vehicle-document-expiry":
      return getVehicleDocumentExpiryReport(filters);
    case "purchase-order":
      return getPurchaseOrderReport(filters);
    case "procurement":
      return getProcurementReport(filters);
    case "procurement-batch":
      return getProcurementBatchReport(filters);
    case "vendor-wise-procurement":
      return getVendorWiseProcurementReport(filters);
    case "sorting-yield":
      return getSortingYieldReport(filters);
    case "wastage":
      return getWastageReport(filters);
    case "sales-order":
      return getSalesOrderReport(filters);
    case "customer-wise-sales":
      return getCustomerWiseSalesReport(filters);
    case "trip":
      return getTripReport(filters);
    case "crate-status":
      return getCrateStatusReport(filters);
    case "crate-overdue":
      return getCrateOverdueReport(filters);
    case "crate-customer-balance":
      return getCrateCustomerBalanceReport(filters);
    case "fuel":
      return getFuelReport(filters);
    case "maintenance":
      return getMaintenanceReport(filters);
    case "payroll-summary":
      return getPayrollSummaryReport(filters);
    case "audit-log":
      return getAuditLogReport(filters);
  }
}

/** Formats a cell value for CSV/Excel export (dates -> ISO date, numbers stay numbers). */
export function formatExportValue(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return format(value, "yyyy-MM-dd");
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}
