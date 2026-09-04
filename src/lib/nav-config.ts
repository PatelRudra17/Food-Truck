import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Package,
  Tags,
  Warehouse,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardEdit,
  ScrollText,
  FileText,
  Truck,
  Users2,
  DoorOpen,
  Fuel,
  Wrench,
  Thermometer,
  BarChart3,
  Bell,
  ShieldCheck,
  UserCog,
  History,
  Settings,
  FolderOpen,
  ScanLine,
  ClipboardList,
  Boxes,
  PackageOpen,
  SlidersHorizontal,
  Trash2,
  Building2,
  Route as RouteIcon,
  Send,
  Undo2,
  Sparkles,
  CalendarClock,
  Repeat,
  ListChecks,
  Users,
  HardHat,
  CalendarCheck,
  Wallet,
  CheckSquare,
} from "lucide-react";
import type { PermissionCode } from "@/lib/auth/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: PermissionCode;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "DASHBOARD_VIEW" }],
  },
  {
    label: "Inventory",
    items: [
      { label: "Item Master", href: "/items", icon: Package, permission: "ITEM_VIEW" },
      { label: "Categories", href: "/categories", icon: Tags, permission: "CATEGORY_VIEW" },
      { label: "Warehouses", href: "/warehouses", icon: Warehouse, permission: "WAREHOUSE_VIEW" },
      { label: "Stock Inward", href: "/stock/inward", icon: ArrowDownToLine, permission: "STOCK_INWARD_VIEW" },
      { label: "Stock Outward", href: "/stock/outward", icon: ArrowUpFromLine, permission: "STOCK_OUTWARD_VIEW" },
      { label: "Stock Transfer", href: "/stock/transfer", icon: ArrowLeftRight, permission: "STOCK_TRANSFER_VIEW" },
      { label: "Stock Adjustment", href: "/stock/adjustment", icon: ClipboardEdit, permission: "STOCK_ADJUSTMENT_VIEW" },
      { label: "Inventory Ledger", href: "/inventory-ledger", icon: ScrollText, permission: "INVENTORY_LEDGER_VIEW" },
      { label: "Storage Temperature", href: "/storage-temperature", icon: Thermometer, permission: "STORAGE_TEMPERATURE_VIEW" },
      { label: "Wastage", href: "/wastage", icon: Trash2, permission: "WASTAGE_VIEW" },
      { label: "Scan Item", href: "/scan", icon: ScanLine, permission: "ITEM_VIEW" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { label: "Procurement", href: "/procurement", icon: ClipboardList, permission: "PROCUREMENT_VIEW" },
      { label: "Procurement Batches", href: "/procurement/batches", icon: Boxes, permission: "PROCUREMENT_VIEW" },
      { label: "Unloading", href: "/procurement/unloading", icon: PackageOpen, permission: "PROCUREMENT_VIEW" },
      { label: "Sorting / Grading", href: "/procurement/sorting", icon: SlidersHorizontal, permission: "SORTING_VIEW" },
      { label: "Purchase Orders", href: "/purchase-orders", icon: FileText, permission: "PURCHASE_ORDER_VIEW" },
      { label: "Vendors", href: "/suppliers", icon: Users2, permission: "SUPPLIER_VIEW" },
    ],
  },
  {
    label: "Sales",
    items: [{ label: "Customers", href: "/customers", icon: Building2, permission: "CUSTOMER_VIEW" }],
  },
  {
    label: "Dispatch & Crates",
    items: [
      { label: "Dispatch", href: "/dispatch", icon: Send, permission: "TRIP_VIEW" },
      { label: "Routes", href: "/routes", icon: RouteIcon, permission: "ROUTE_VIEW" },
      { label: "Crates", href: "/crates", icon: Boxes, permission: "CRATE_VIEW" },
      { label: "Crate Returns", href: "/crates/returns", icon: Undo2, permission: "CRATE_VIEW" },
    ],
  },
  {
    label: "Fleet & Logistics",
    items: [
      { label: "Vehicles", href: "/vehicles", icon: Truck, permission: "VEHICLE_VIEW" },
      { label: "Drivers", href: "/drivers", icon: Users2, permission: "DRIVER_VIEW" },
      { label: "Gate Entry / Exit", href: "/gate", icon: DoorOpen, permission: "GATE_ENTRY_VIEW" },
      { label: "Fuel Management", href: "/fuel", icon: Fuel, permission: "FUEL_VIEW" },
      { label: "Vehicle Maintenance", href: "/maintenance", icon: Wrench, permission: "MAINTENANCE_VIEW" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Cleaning", href: "/operations/cleaning", icon: Sparkles, permission: "OPERATIONS_VIEW" },
      { label: "Shifts", href: "/operations/shifts", icon: CalendarClock, permission: "OPERATIONS_VIEW" },
      { label: "Shift Handover", href: "/operations/shifts/handover", icon: Repeat, permission: "OPERATIONS_VIEW" },
      { label: "Next-Day Preparation", href: "/operations/next-day", icon: ListChecks, permission: "OPERATIONS_VIEW" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Employees", href: "/employees", icon: Users, permission: "EMPLOYEE_VIEW" },
      { label: "Labour", href: "/labour", icon: HardHat, permission: "LABOUR_VIEW" },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck, permission: "ATTENDANCE_VIEW" },
      { label: "Payroll", href: "/payroll", icon: Wallet, permission: "PAYROLL_VIEW" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3, permission: "REPORT_VIEW" },
      { label: "Notifications", href: "/notifications", icon: Bell },
      { label: "Documents", href: "/documents", icon: FolderOpen, permission: "DOCUMENT_VIEW" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/settings/users", icon: UserCog, permission: "MANAGE_USERS" },
      { label: "Roles & Permissions", href: "/settings/roles", icon: ShieldCheck, permission: "MANAGE_ROLES" },
      { label: "Audit Log", href: "/settings/audit-log", icon: History, permission: "VIEW_AUDIT_LOG" },
      { label: "Approval Center", href: "/settings/approvals", icon: CheckSquare, permission: "MANAGE_SETTINGS" },
      { label: "System Settings", href: "/settings", icon: Settings, permission: "MANAGE_SETTINGS" },
    ],
  },
];
