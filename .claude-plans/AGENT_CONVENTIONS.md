# Build conventions — read this fully before writing any code

You are implementing one slice of a large real, production-shaped Next.js ERP
app ("Enterprise Inventory & Logistics Management System"). Other agents are
building other slices in parallel. The foundation below already exists and
works end-to-end (auth, dashboard, seed data all verified in a browser) — do
not modify it, only build on top of it. Read the actual files before using
them; this doc describes them but the files are the source of truth.

**This must be REAL functionality.** Every list, form, and number must come
from PostgreSQL via Prisma. No hardcoded numbers, no "Coming soon" buttons, no
fake charts, no client-side-only mock data. If something is genuinely out of
scope, leave it out rather than fake it.

## Tech stack already in place

- Next.js 16 (App Router, Turbopack), TypeScript, React 19, Tailwind v4.
- shadcn/ui components in `src/components/ui/*` (button, input, select,
  checkbox, switch, textarea, card, table, tabs, dialog, alert-dialog,
  dropdown-menu, popover, badge, avatar, separator, sheet, skeleton, sonner
  (toast), tooltip, calendar, command, breadcrumb, pagination, progress,
  scroll-area, accordion, navigation-menu, radio-group, field, input-group.
  There is NO `form.tsx` (the old shadcn Form wrapper) — use react-hook-form
  directly with these primitives; don't try to add a `form` component.
- PostgreSQL + Prisma 6 (`prisma/schema.prisma` — READ THIS FIRST for exact
  field names/types/enums of every model you touch. Do not modify this file
  or run migrations — if you find a genuine schema gap, stop and report it
  instead of editing the schema).
- `zod` for validation, `react-hook-form` + `@hookform/resolvers/zod` for
  forms, `date-fns` for dates, `recharts` for charts, `@tanstack/react-table`
  for tables, `exceljs` for Excel export, `qrcode` + `jsbarcode` for
  codes, `@react-pdf/renderer` for PDF generation.

## Critical gotcha: `@tanstack/react-table` v9 import paths

The installed `@tanstack/react-table` is v9.2.4 (pre-release, reworked API).
Import `ColumnDef` (and `flexRender`) from the **main** package:
`import { flexRender, type ColumnDef } from "@tanstack/react-table";` — NOT
from `@tanstack/react-table/legacy`. The `/legacy` subpath only exports the
compat-layer helpers actually used to build the table instance
(`useLegacyTable`, `getCoreRowModel`, `getPaginationRowModel`, etc. —
`LegacyColumnDef`, not `ColumnDef`). `src/components/shared/data-table.tsx`
is the reference for the correct split between the two imports — every
`*-table.tsx` you write should follow it exactly.

## Critical gotcha: `useForm` + `zodResolver` + `z.coerce`

Any zod schema field using `z.coerce.number()` / `z.coerce.boolean()` has an
INPUT type of `unknown` and an OUTPUT type of `number`/`boolean`.
`@hookform/resolvers` (v5.9.1) types the resolver against the schema's INPUT
type. If you type `useForm<OutputType>(...)` (e.g. the type from
`z.infer<typeof schema>`) instead, you get a "ResolverOptions is not
assignable" compile error. Fix: use the 3-generic `useForm` overload —
`useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
resolver: zodResolver(schema), ... })` — then `onSubmit` (passed to
`handleSubmit`) receives the coerced OUTPUT type, while `register`/`watch`
work against the raw INPUT type. See `src/components/maintenance/
maintenance-form.tsx` for a working example of this pattern.

## Critical gotcha: Server → Client serialization

Server Components may only pass **plain serializable data** as props into a
`"use client"` component. This breaks in two ways you WILL hit:

1. **Prisma `Decimal` fields** (stock quantities, prices, km, costs — anything
   `@db.Decimal` in the schema) are class instances, not plain numbers.
   Convert every Decimal field with `Number(x)` (or `.toString()` if you need
   exact precision for money) before passing rows into `<DataTable>` or any
   other client component. Do this in the server component/service layer,
   e.g. `rows.map(r => ({ ...r, currentStock: Number(r.currentStock) }))`.
2. **Icon components / functions / class instances** can never be passed as
   props across the boundary either. `Date` objects, plain objects, arrays,
   strings, numbers, booleans are fine.

If you see "Only plain objects can be passed to Client Components from
Server Components", this is almost always the cause.

## Auth, permissions, and the request lifecycle

- `src/lib/auth/guard.ts`: `requireUser()` and `requirePermission(code)` —
  call `requirePermission(...)` as the FIRST line of every server action and
  every page/layout that shows protected data. Never rely on hiding a button.
- `src/lib/auth/permissions.ts`: the full `PermissionCode` union. Codes are
  `${RESOURCE}_${ACTION}`, e.g. `ITEM_VIEW`, `STOCK_INWARD_APPROVE`,
  `VEHICLE_DOCUMENT_EDIT`. Look up the exact resource name in that file
  (RESOURCES array) — don't invent new permission codes.
- `src/lib/nav-config.ts` already lists every route this app will have, each
  with the exact permission code that gates it. Match your pages' routes and
  guard checks to what's already declared there — don't add new nav entries
  unless a route you must build genuinely has no entry yet (then add it
  following the existing pattern).
- `src/lib/audit.ts`: `writeAuditLog({ userId, action, entityType, entityId,
  oldValues?, newValues? })` — call this after every create/edit/archive/
  approve/reject/export/document-access in your slice.

## Server action pattern

Put server actions in `src/lib/actions/<module>-actions.ts` (`"use server"` at
the top). Put zod schemas in `src/lib/validators/<module>.ts`. Shape:

```ts
"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/validators/common";
import { actionError } from "@/lib/validators/common";

export async function createItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("ITEM_CREATE");
    const data = itemSchema.parse(input); // throws ZodError -> caught below
    const created = await prisma.item.create({ data: { ... } });
    await writeAuditLog({ userId: user.id, action: "CREATE", entityType: "Item", entityId: created.id, newValues: data });
    revalidatePath("/items");
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionError(error);
  }
}
```

`ActionResult<T>` and `actionError()` are in `src/lib/validators/common.ts`
— always return this shape from actions so the UI can show `result.error` via
`sonner`'s `toast.error(...)` / `toast.success(...)` (the `<Toaster>` is
already mounted globally in the root layout).

For list pages, use `paginationSchema` / `paginationMeta` from the same file:
read `page`/`pageSize` from `searchParams`, query with `skip`/`take`, and pass
`paginationMeta(total, pagination)` to `<DataTable>`.

## Inventory engine — never touch `Item.currentStock` directly

Any code that changes stock MUST go through
`applyStockMovement(tx, { itemId, warehouseId, transactionType, quantity, referenceType, referenceId, referenceNumber, userId, reason? })`
from `src/lib/services/inventory.ts`, called inside a `prisma.$transaction`.
It row-locks the item, checks the negative-stock policy, updates
`currentStock`, and writes the `InventoryLedger` row — all three always happen
together. `transactionType` is the `LedgerTxnType` enum (`INWARD`, `OUTWARD`,
`TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT_POSITIVE`, `ADJUSTMENT_NEGATIVE`,
`DAMAGED_DISPOSED`, `OPENING`). Business timing:

- **Stock Inward**: create as DRAFT/PENDING, move through APPROVED, and only
  on transition to **RECEIVED** call `applyStockMovement` with `INWARD` for
  every item (guard against re-processing an already-RECEIVED/CANCELLED
  document). If `purchaseOrderId` is set and inward items carry `poItemId`,
  call `applyReceiptToPurchaseOrder(tx, { poId, receipts })` from
  `src/lib/services/purchase-order.ts` in the same transaction.
- **Stock Outward**: validate `requestedQty <= item.currentStock` at
  submission time (read `isNegativeStockAllowed()` from
  `src/lib/services/inventory.ts` to decide whether to hard-block). Only
  decrement stock (`OUTWARD`) on transition to **ISSUED**.
- **Stock Transfer**: decrement source (`TRANSFER_OUT`) on **DISPATCHED**;
  increment destination (`TRANSFER_IN`) on **RECEIVED**. Stock is "in
  transit" between those two states — don't double count.
- **Stock Adjustment**: apply the signed difference
  (`ADJUSTMENT_POSITIVE`/`ADJUSTMENT_NEGATIVE` depending on sign) only on
  transition to **APPROVED**.
- Use `nextDocumentNumber(tx, "STOCK_INWARD" | "STOCK_OUTWARD" |
  "STOCK_TRANSFER" | "STOCK_ADJUSTMENT" | "PURCHASE_ORDER" | "GATE_ENTRY" |
  "GATE_EXIT")` from `src/lib/numbering.ts` inside the same transaction that
  creates the document, so a rollback also rolls back the sequence.

## Approvals

The generic `Approval` model (requestedBy/decidedBy/decision/comment) backs
every approval workflow (Outward, Adjustment, PO, Transfer, and Inward when
you choose to require it). When a document enters an approval-required
status, create an `Approval` row linked via the matching relation field on
`Approval` (`outwardFk`, `adjustmentFk`, `poFk`, `transferFk`, `inwardFk`).
An approve/reject action updates both the `Approval` row (`decision`,
`decidedById`, `decidedAt`, `comment`) and the parent document's `status` in
the same transaction, then calls `writeAuditLog` with action `APPROVE` or
`REJECT`.

## Notifications

`src/lib/services/notifications.ts`: `notifyUser(tx, {...})`,
`notifyRoleByName(roleName, {...})` (role names are in
`src/lib/auth/permissions.ts` `ROLE_NAMES`). Fire these on: low stock crossing
reorder level, document nearing/at expiry, something entering pending
approval, PO/transfer pending, maintenance due, temperature alert, fuel
anomaly — whatever is relevant to your slice. `NotificationType` enum is in
the schema.

## Documents / file uploads

`src/lib/storage.ts`: `validateUpload({type, size})` (throws
`UploadValidationError`), `uploadObject({buffer, mimeType, entityType,
originalFileName})` returns `{ storageKey }`, `getSignedDownloadUrl(storageKey)`
returns a short-lived signed URL — never store or return a public URL. Create
an `Attachment` row pointing at your entity via its specific FK field
(`itemFk`, `vehicleFk`, `driverFk`, `vehicleDocFk`, `driverDocFk`, `inwardFk`,
`outwardFk`, `adjustmentFk`, `fuelEntryFk`, `maintenanceFk`, `supplierFk`).
File uploads in a server action: accept `FormData`, read the `File` via
`formData.get("file") as File`, `Buffer.from(await file.arrayBuffer())`.

For **driver identity documents** (Aadhaar/PAN/Driving Licence), use
`encryptSensitive(plaintext)` / `decryptSensitive(payload)` and
`maskForDocType(docType, value)` from `src/lib/crypto.ts`. Store only the
encrypted payload + precomputed masked string in `DriverDocument`
(`numberEncrypted`, `numberMasked`) — never store or log the plaintext value,
never send it to the client. Only decrypt when a user holding
`VIEW_SENSITIVE_DRIVER_DOCUMENTS` explicitly requests the unmasked value via a
dedicated server action, and write a `SENSITIVE_DOCUMENT_ACCESS` audit log
entry (with a `DocumentAccessLog` row too) every time that happens.

## UI conventions

- Every page: `<PageHeader title=... description=... actions={...} />` from
  `src/components/shared/page-header.tsx` at the top.
- List pages: server component reads `searchParams`, fetches one page of data
  via a service/action, renders `<DataTable columns={...} data={...}
  pagination={...} />` (`src/components/shared/data-table.tsx`) with a
  `<TableSearchInput placeholder="..." />` (`src/components/shared/
  table-search-input.tsx`) above it for free-text search bound to the `q`
  URL param (read it server-side and filter with Prisma `contains`,
  `mode: "insensitive"`).
- Status enums render via `<StatusBadge status={...} />`
  (`src/components/shared/status-badge.tsx`) — it already has tone mappings
  for every status string used across the schema's enums.
- Empty states: `<EmptyState icon={...} title=... description=... 
  actionLabel=... actionHref=... />` (`src/components/shared/empty-state.tsx`).
- Destructive/approval actions: wrap the trigger button in `<ConfirmDialog
  trigger={...} title=... description=... onConfirm={() => someAction(...)}
  destructive />` (`src/components/shared/confirm-dialog.tsx`) — never fire
  approve/reject/archive/cancel/adjustment/delete on a single click.
- Forms: react-hook-form + `zodResolver`, built from shadcn `Input`/
  `Select`/`Textarea`/`Checkbox`/`Switch`/`RadioGroup`/`Label` +
  `Button`. Use a `Dialog` for short create/edit forms, or a dedicated
  `/new` or `/[id]/edit` page for long multi-item forms (Inward/Outward/
  Transfer/PO all have line items — give those their own page, not a modal).
  Show field errors under each field; show a top-level error banner for
  server-side `ActionResult` failures.
- Every list/detail page needs loading (skeleton via `<Skeleton>` or
  `<DataTable isLoading />`), empty, error, and success states — no bare
  blank screens.
- Numbers: money and quantities render with `.toLocaleString()`; dates via
  `date-fns` `format(date, "dd MMM yyyy")` or `formatDistanceToNow`.
- Route structure: `src/app/(app)/<module>/page.tsx` (list),
  `src/app/(app)/<module>/new/page.tsx` (create, when it's a full page),
  `src/app/(app)/<module>/[id]/page.tsx` (detail/edit). The `(app)` group's
  `layout.tsx` already renders the sidebar/header and enforces
  authentication — you don't need to re-check login, only permissions.

## Reports & exports

`src/lib/services/export.ts`: `buildCsv(headers, rows)` returns a string,
`buildExcelBuffer({sheetName, headers, rows})` returns a `Buffer`,
`fileResponseHeaders(filename, mimeType)` gives you the right headers. Implement
exports as Route Handlers, e.g. `src/app/api/exports/items/route.ts`:
`requirePermission("ITEM_EXPORT")` first, query data, build the file, `return
new Response(csvString or buffer, { headers: fileResponseHeaders(...) })`.
For "Print", build a print-friendly page (clean layout, `@media print` CSS)
and a button calling `window.print()` — don't generate a server PDF just for
on-screen printing. For structured downloadable PDFs (e.g. an inward/outward
receipt), use `@react-pdf/renderer`'s `renderToBuffer` in a route handler.

## What NOT to do

- Don't touch `prisma/schema.prisma`, `src/lib/auth/permissions.ts`,
  `src/lib/nav-config.ts`, `src/middleware.ts`/`src/proxy.ts`, or anything
  already in `src/lib/` (env, prisma client, crypto, session, guard, audit,
  storage, numbering, inventory, notifications, temperature, maintenance,
  dispatch, fuel, dashboard, purchase-order, export) — these are shared,
  already-working infrastructure other agents also depend on.
- Don't add new npm dependencies without a strong reason; everything listed
  above is already installed.
- Don't build a generic/abstract framework for "future flexibility" — build
  exactly the module(s) you were assigned, following the patterns above.
- Don't fabricate data, mock API responses, or leave TODO/"coming soon" UI.

## Kishan Corporation expansion (Phase 1 foundation, already in schema)

The app is being expanded per `FULL_WEBSITE_BUILD_PROMPT.md` into a full
fresh-produce ERP (procurement → sorting/grading → wastage → sales →
dispatch/trips → crates → operations → workforce), built phase by phase per
that doc's own Development Order (§102). **Phase 1 (schema + permissions +
seed) is already done** — every model, enum, permission resource, and role
grant the whole build will need already exists in `prisma/schema.prisma` and
`src/lib/auth/permissions.ts`. Later phases build pages/actions/services
against this schema and must not modify it further; if you find a genuine
gap, stop and report it rather than editing the schema yourself.

Key things to know before building any of these modules:

- **Vendor = `Supplier`.** There is no separate `Vendor` model — the doc's
  "Vendor Management" module is the existing `/suppliers` module. Use
  `Supplier` (now has a `location` field too).
- **Grade-aware stock has its own ledger, separate from the generic one.**
  `Item.currentStock` (via `applyStockMovement` in `inventory.ts`) still
  tracks the vegetable's total stock and must not be bypassed. Grade-wise
  balances (Grade A/B/C/Raw/Other) live in `ItemGradeStock` (current balance
  per item+warehouse+grade) and `GradeLedger` (the audit trail, using
  `GradeLedgerTxnType`: PROCUREMENT/SORTING/WASTAGE/SALE/DISPATCH/
  TRANSFER_IN/TRANSFER_OUT/ADJUSTMENT/RETURN/DISPOSAL). Whichever phase
  builds Sorting must add an `applyGradeStockMovement(tx, {...})` service
  (new file, e.g. `src/lib/services/produce-inventory.ts`) that mirrors
  `applyStockMovement`'s row-lock + ledger-write pattern exactly, and also
  calls `applyStockMovement` for the same item so the two stay in sync.
- **`/dispatch` and `/dispatch/trips/[id]` both operate on the `Trip` model**
  — there is no separate `Dispatch` table. `/dispatch` is a filtered list of
  `Trip` rows (pending/loading/dispatched/returned).
- **Wastage and warehouse disposal are both the `Wastage` model**,
  distinguished by `stage` (`SORTING` vs `WAREHOUSE`).
- **Crate history is `Crate.status` + `AuditLog`**, not a separate movement
  table. `CrateReturn` is the per-trip aggregate return record.
- **`ShiftHandover`/`NextDayPreparation` store only what's actually entered**
  (remarks, sign-off, checklist items). Counts like "pending sorting" or
  "vehicles inside" must be computed live from the real tables when that
  page renders — never store them, they go stale immediately.
- **`checkDispatchEligibility()` in `src/lib/services/dispatch.ts`** already
  checks vehicle status/maintenance/document expiry. The Trip/dispatch phase
  should extend it (or add a sibling function) to also check driver licence
  validity and required stock before assigning a vehicle+driver to a `Trip`;
  any override sets `Trip.eligibilityOverride`/`eligibilityOverrideReason`
  and must call `writeAuditLog` with the new `"DISPATCH_OVERRIDE"` action.
- **New permission resources** already in `RESOURCES`: `PROCUREMENT,
  SORTING, WASTAGE, CUSTOMER, SALES_ORDER, ROUTE, TRIP, CRATE, OPERATIONS,
  EMPLOYEE, LABOUR, ATTENDANCE, PAYROLL` (`OPERATIONS` covers cleaning/
  shift/handover/next-day-prep as one resource). A new `"HR / Payroll"` role
  exists with full CRUD on the workforce resources.
- **New numbering prefixes** already in `src/lib/numbering.ts`:
  `PROCUREMENT` (PROC), `PROCUREMENT_BATCH` (BAT), `SALES_ORDER` (SO),
  `TRIP` (TRIP), `CRATE_RETURN` (CRT), `WASTAGE` (WST).
- **`src/lib/nav-config.ts` has no entries for any of these modules yet** —
  add nav items only in the same phase that ships the real pages, so the
  sidebar never points at a route with no page behind it.
- **`src/components/shared/status-badge.tsx`** needs a `TONE_MAP` entry
  added for each new status enum's UI as you build it, or it falls back to
  an unstyled pill.
- Master data for the new domain (a handful of `Customer`, `Route`,
  `RouteCluster`, `Crate`, `Shift`, `Employee`, `Labour` rows) is already
  seeded in `prisma/seed.ts`. Transactional demo data (batches, sorting,
  sales orders, trips, attendance, salary) is intentionally NOT seeded yet —
  seed it in the same phase that builds the real service function that
  creates it, using that function (not raw `prisma.create`), matching how
  the existing seed handles stock inward/outward.

## When you're done

Report back: which routes/files you created, any permission codes you used
that weren't already in `nav-config.ts` (and why), any schema gap you hit but
did not fix, and confirm the dev server (already running on
`http://localhost:3000`) compiles your new routes without errors — check by
reading recent Next.js dev server output or, if you have browser tools,
navigating to your new pages while logged in.
