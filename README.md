# Kishan Corporation — Fresh Produce ERP

A production-shaped Next.js 16 ERP covering fresh-produce procurement,
sorting/grading, inventory, sales, dispatch/logistics, fleet, and workforce
management. Built on top of an existing Enterprise Inventory & Logistics
Management System foundation (auth, RBAC, audit, inventory engine, stock
inward/outward/transfer/adjustment, purchase orders, vehicles/drivers, gate
entry, fuel/maintenance, storage temperature monitoring), extended with the
full Kishan Corporation module set — see `FULL_WEBSITE_BUILD_PROMPT.md` for
the original specification and `.claude-plans/AGENT_CONVENTIONS.md` for the
architecture/build conventions followed throughout.

## Tech stack

- Next.js 16 (App Router, Turbopack), TypeScript, React 19, Tailwind CSS v4
- PostgreSQL + Prisma 6
- shadcn/ui, react-hook-form + zod, @tanstack/react-table, recharts
- exceljs (Excel export), @react-pdf/renderer (PDF), qrcode + jsbarcode
- AWS SDK S3 client (S3-compatible object storage — MinIO for local dev)
- vitest for unit tests

## Project setup

```bash
npm install
cp .env.example .env   # fill in real secrets — see below
```

### Environment variables

See `.env.example` for the full list with generation instructions. At minimum
for local development you need:

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — `openssl rand -hex 32`
- `DOCUMENT_ENCRYPTION_KEY` — `openssl rand -hex 32` (AES-256-GCM key used to
  encrypt sensitive driver identity documents — Aadhaar/PAN/Licence — at rest)
- `STORAGE_*` — S3-compatible object storage endpoint/credentials (MinIO via
  `docker-compose.yml` works out of the box for local dev)

Never commit a real `.env` file or real secrets.

### Local infrastructure (Postgres + MinIO)

```bash
docker compose up -d
```

This starts Postgres (mapped to `localhost:5442` per `.env.example`) and
MinIO (S3-compatible object storage, `localhost:9000`/`9001` console).

### Database setup

```bash
npm run db:generate   # generate the Prisma client
npm run db:migrate    # apply migrations (creates the schema)
npm run db:seed       # seed development data — see below
```

`npm run db:reset` drops and recreates the database from migrations, then
re-seeds (destructive — local/dev only).

### Seed data & development login

`npm run db:seed` creates:

- One demo user per role (all use the same password, printed at the end of
  the seed run): Super Admin, Store Manager, Store Operator, Vehicle Manager,
  Gate Operator, Auditor, Management, HR / Payroll — emails follow the
  pattern `role.name@demo.local` (e.g. `store.manager@demo.local`).
- Master data: categories, warehouses, vendors, a vegetable/item catalog,
  drivers + vehicles (with fake, clearly non-real identity documents),
  customers, routes, crates, shifts, employees, and labour.
- A full transactional demo chain exercising the real business logic:
  procurement → gate entry → unloading → sorting/grading → wastage → sales
  orders → dispatch trips (at various lifecycle stages) → crate returns →
  attendance → payroll → cleaning → next-day preparation.

The seed script is idempotent-ish: master data uses `upsert` and is safe to
re-run; re-running adds another round of transactional demo records (matching
how a real day's operations would accumulate), it will not corrupt existing
data or violate unique constraints.

**Never use real Aadhaar, PAN, driving licence, or other real personal/
identity information in seed or demo data** — the seed script only ever
generates fake data via `@faker-js/faker`.

### Development server

```bash
npm run dev
```

Runs on `http://localhost:3000` by default. If that port is occupied (e.g. by
another project), set `PORT`:

```bash
PORT=3001 npm run dev
```

### Testing

```bash
npm run test          # runs the vitest suite once
npx vitest             # watch mode
```

Current coverage is unit tests for pure business logic (dispatch eligibility
checks, sensitive-document masking, fuel derived-field calculations, and
validator business rules like the sorting weight-balance rule). Tests never
open a real database connection — see `vitest.config.ts`.

### Linting & type-checking

```bash
npm run lint
npx tsc --noEmit
```

### Production build

```bash
npm run build
npm run start
```

## Architecture notes

- **Server Actions** live in `src/lib/actions/<module>-actions.ts`. Every
  action starts with `requirePermission(...)` (server-side, never relies on
  hiding a UI button) and calls `writeAuditLog(...)` on every
  create/edit/archive/approve/reject.
- **The generic inventory engine** (`src/lib/services/inventory.ts`,
  `applyStockMovement`) tracks each item's total stock. **The grade-aware
  produce engine** (`src/lib/services/produce-inventory.ts`,
  `applyGradeStockMovement`) tracks the same total broken down by grade
  (Raw/A/B/C/Other) for sorted produce, and keeps the generic total in sync —
  see that file's header comment for the full transaction-type mapping table.
- **Sensitive documents** (driver Aadhaar/PAN/Licence) are encrypted at rest
  (`src/lib/crypto.ts`, AES-256-GCM) with only a masked value ever rendered
  in the UI; viewing the unmasked value requires the
  `VIEW_SENSITIVE_DRIVER_DOCUMENTS` permission and is access-logged.
  Documents themselves are stored in private object storage
  (`src/lib/storage.ts`) — never a public URL.
- **Permissions** are centrally registered in `src/lib/auth/permissions.ts`
  (`RESOURCES` × `ACTIONS` → CRUD codes, plus special codes) and seeded per
  role via `DEFAULT_ROLE_PERMISSIONS`.
- **Navigation** (`src/lib/nav-config.ts`) is permission-gated — a sidebar
  entry only ever points at a route that has a real page behind it.

## Backup recommendations

- PostgreSQL: use `pg_dump` on a schedule appropriate to your transaction
  volume; this app performs financial and inventory-critical writes, so
  point-in-time recovery (WAL archiving) is recommended for production.
- Object storage (S3/MinIO): enable versioning and cross-region replication
  or scheduled bucket backups for uploaded documents, since `Attachment`
  rows reference storage keys that must remain resolvable.
- Never back up `.env` files or the `DOCUMENT_ENCRYPTION_KEY` alongside
  application code repositories; store secrets in a dedicated secrets
  manager for production deployments.
