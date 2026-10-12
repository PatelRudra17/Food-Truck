import type { PermissionCode } from "@/lib/auth/permissions";

/**
 * Which permission decides an Approval row, keyed by Approval.entityType. Each
 * approve/reject server action re-checks the same permission itself; this map
 * only decides who may open the Approval Center and which rows they see there.
 */
export const APPROVAL_PERMISSION_BY_ENTITY_TYPE = {
  StockOutward: "STOCK_OUTWARD_APPROVE",
  StockAdjustment: "STOCK_ADJUSTMENT_APPROVE",
  PurchaseOrder: "PURCHASE_ORDER_APPROVE",
  StockTransfer: "STOCK_TRANSFER_APPROVE",
  StockInward: "STOCK_INWARD_APPROVE",
  SalesOrder: "SALES_ORDER_APPROVE",
  Wastage: "WASTAGE_APPROVE",
} as const satisfies Record<string, PermissionCode>;

/** Permissions that open the Approval Center: settings admins plus anyone who can approve something listed there. */
export const APPROVAL_CENTER_PERMISSIONS: PermissionCode[] = [
  "MANAGE_SETTINGS",
  ...Object.values(APPROVAL_PERMISSION_BY_ENTITY_TYPE),
];

/** Approval entity types this user may list and decide. */
export function approvableEntityTypes(permissions: readonly string[]): string[] {
  return Object.entries(APPROVAL_PERMISSION_BY_ENTITY_TYPE)
    .filter(([, permission]) => permissions.includes(permission))
    .map(([entityType]) => entityType);
}
