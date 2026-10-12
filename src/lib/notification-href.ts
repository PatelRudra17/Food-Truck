/**
 * Where a notification should take the user, based on the entity it refers to.
 * Shared by the /notifications page and the header bell so both link the same way.
 */
export function notificationHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  switch (entityType) {
    case "StockInward":
      return `/stock/inward/${entityId}`;
    case "StockOutward":
      return `/stock/outward/${entityId}`;
    case "StockTransfer":
      return `/stock/transfer/${entityId}`;
    case "StockAdjustment":
      return `/stock/adjustment/${entityId}`;
    case "PurchaseOrder":
      return `/purchase-orders/${entityId}`;
    case "Vehicle":
      return `/vehicles/${entityId}`;
    case "Driver":
      return `/drivers/${entityId}`;
    case "Supplier":
      return `/suppliers/${entityId}`;
    case "Item":
      return `/items/${entityId}`;
    // These have no per-record page; link to the list they appear on.
    case "ShiftHandover":
      return "/operations/shifts/handover";
    case "NextDayChecklistItem":
      return "/operations/next-day";
    case "FuelEntry":
      return "/fuel";
    default:
      return null;
  }
}

/** Fired after notifications are marked read so the header bell can refresh its badge immediately. */
export const NOTIFICATIONS_CHANGED_EVENT = "notifications:changed";
