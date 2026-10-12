/**
 * Central permission registry. Every server action / route handler must check
 * one of these codes via requirePermission() — never rely on hiding UI alone.
 */

export const RESOURCES = [
  "DASHBOARD",
  "ITEM",
  "CATEGORY",
  "WAREHOUSE",
  "SUPPLIER",
  "STOCK_INWARD",
  "STOCK_OUTWARD",
  "STOCK_TRANSFER",
  "STOCK_ADJUSTMENT",
  "INVENTORY_LEDGER",
  "PURCHASE_ORDER",
  "VEHICLE",
  "DRIVER",
  "VEHICLE_DOCUMENT",
  "DRIVER_DOCUMENT",
  "GATE_ENTRY",
  "FUEL",
  "MAINTENANCE",
  "STORAGE_TEMPERATURE",
  "REPORT",
  "NOTIFICATION",
  "DOCUMENT",
  "PROCUREMENT",
  "SORTING",
  "WASTAGE",
  "CUSTOMER",
  "SALES_ORDER",
  "ROUTE",
  "TRIP",
  "CRATE",
  "OPERATIONS",
  "EMPLOYEE",
  "LABOUR",
  "PAYROLL",
] as const;

export const ACTIONS = [
  "VIEW",
  "CREATE",
  "EDIT",
  "ARCHIVE",
  "APPROVE",
  "EXPORT",
  "PRINT",
  "DOWNLOAD_DOCUMENT",
] as const;

type Resource = (typeof RESOURCES)[number];
type Action = (typeof ACTIONS)[number];

function crud(resource: Resource, actions: readonly Action[] = ACTIONS) {
  return actions.map((action) => `${resource}_${action}` as const);
}

export const CRUD_PERMISSIONS = RESOURCES.flatMap((r) => crud(r));

export const SPECIAL_PERMISSIONS = [
  "VIEW_SENSITIVE_DRIVER_DOCUMENTS",
  "MANAGE_USERS",
  "MANAGE_ROLES",
  "MANAGE_SETTINGS",
  "VIEW_AUDIT_LOG",
  "GLOBAL_SEARCH",
  "OVERRIDE_MAINTENANCE_BLOCK",
  "OVERRIDE_NEGATIVE_STOCK",
] as const;

export const ALL_PERMISSIONS = [...CRUD_PERMISSIONS, ...SPECIAL_PERMISSIONS] as const;

export type PermissionCode = (typeof ALL_PERMISSIONS)[number];

export function permCode(resource: Resource, action: Action): PermissionCode {
  return `${resource}_${action}` as PermissionCode;
}

export const ROLE_NAMES = [
  "Super Admin",
  "Store Manager",
  "Store Operator",
  "Vehicle Manager",
  "Gate Operator",
  "Auditor",
  "Management",
  "HR / Payroll",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

/** Default permission grants per role, used by the seed script. */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, PermissionCode[]> = {
  "Super Admin": [...ALL_PERMISSIONS],

  "Store Manager": [
    ...crud("ITEM"),
    ...crud("CATEGORY"),
    ...crud("WAREHOUSE"),
    ...crud("SUPPLIER"),
    ...crud("STOCK_INWARD"),
    ...crud("STOCK_OUTWARD"),
    ...crud("STOCK_TRANSFER"),
    ...crud("STOCK_ADJUSTMENT"),
    ...crud("INVENTORY_LEDGER", ["VIEW", "EXPORT", "PRINT"]),
    ...crud("PURCHASE_ORDER"),
    ...crud("REPORT", ["VIEW", "EXPORT", "PRINT"]),
    ...crud("NOTIFICATION", ["VIEW"]),
    ...crud("DOCUMENT", ["VIEW", "CREATE", "DOWNLOAD_DOCUMENT"]),
    ...crud("DASHBOARD", ["VIEW"]),
    ...crud("PROCUREMENT"),
    ...crud("SORTING"),
    ...crud("WASTAGE"),
    ...crud("CUSTOMER"),
    ...crud("SALES_ORDER"),
    ...crud("ROUTE"),
    ...crud("TRIP"),
    ...crud("CRATE"),
    ...crud("OPERATIONS"),
    "GLOBAL_SEARCH",
  ],

  "Store Operator": [
    ...crud("ITEM", ["VIEW"]),
    ...crud("CATEGORY", ["VIEW"]),
    ...crud("WAREHOUSE", ["VIEW"]),
    ...crud("STOCK_INWARD", ["VIEW", "CREATE", "EDIT", "PRINT"]),
    ...crud("STOCK_OUTWARD", ["VIEW", "CREATE", "EDIT", "PRINT"]),
    ...crud("STOCK_TRANSFER", ["VIEW", "CREATE"]),
    ...crud("STOCK_ADJUSTMENT", ["VIEW", "CREATE"]),
    ...crud("INVENTORY_LEDGER", ["VIEW"]),
    ...crud("DOCUMENT", ["VIEW", "CREATE"]),
    ...crud("DASHBOARD", ["VIEW"]),
    ...crud("PROCUREMENT", ["VIEW", "CREATE", "EDIT"]),
    ...crud("SORTING", ["VIEW", "CREATE", "EDIT"]),
    ...crud("WASTAGE", ["VIEW", "CREATE", "EDIT"]),
    ...crud("SALES_ORDER", ["VIEW", "CREATE", "EDIT"]),
    ...crud("CUSTOMER", ["VIEW"]),
    ...crud("ROUTE", ["VIEW"]),
    ...crud("TRIP", ["VIEW"]),
    ...crud("CRATE", ["VIEW"]),
    ...crud("OPERATIONS", ["VIEW"]),
    "GLOBAL_SEARCH",
  ],

  "Vehicle Manager": [
    ...crud("VEHICLE"),
    ...crud("DRIVER"),
    ...crud("VEHICLE_DOCUMENT"),
    ...crud("DRIVER_DOCUMENT", ["VIEW", "CREATE", "EDIT", "ARCHIVE"]),
    ...crud("FUEL"),
    ...crud("MAINTENANCE"),
    ...crud("GATE_ENTRY", ["VIEW"]),
    ...crud("REPORT", ["VIEW", "EXPORT", "PRINT"]),
    ...crud("DOCUMENT", ["VIEW", "CREATE", "DOWNLOAD_DOCUMENT"]),
    ...crud("DASHBOARD", ["VIEW"]),
    ...crud("TRIP", ["VIEW", "CREATE", "EDIT"]),
    ...crud("ROUTE", ["VIEW", "CREATE", "EDIT"]),
    ...crud("CRATE", ["VIEW", "CREATE", "EDIT"]),
    ...crud("OPERATIONS", ["VIEW"]),
    "VIEW_SENSITIVE_DRIVER_DOCUMENTS",
    "OVERRIDE_MAINTENANCE_BLOCK",
    "GLOBAL_SEARCH",
  ],

  "Gate Operator": [
    ...crud("GATE_ENTRY", ["VIEW", "CREATE", "EDIT", "PRINT"]),
    ...crud("VEHICLE", ["VIEW"]),
    ...crud("DRIVER", ["VIEW"]),
    ...crud("DASHBOARD", ["VIEW"]),
    ...crud("PROCUREMENT", ["VIEW"]),
  ],

  Auditor: [
    ...RESOURCES.flatMap((r) => crud(r, ["VIEW", "EXPORT", "PRINT"])),
    "VIEW_AUDIT_LOG",
    "GLOBAL_SEARCH",
  ],

  Management: [
    ...RESOURCES.flatMap((r) => crud(r, ["VIEW", "EXPORT", "PRINT"])),
    "GLOBAL_SEARCH",
  ],

  "HR / Payroll": [
    ...crud("EMPLOYEE"),
    ...crud("LABOUR"),
    ...crud("PAYROLL"),
    ...crud("DASHBOARD", ["VIEW"]),
    ...crud("REPORT", ["VIEW", "EXPORT", "PRINT"]),
    "GLOBAL_SEARCH",
  ],
};
