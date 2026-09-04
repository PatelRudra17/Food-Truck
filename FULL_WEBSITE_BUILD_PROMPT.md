# KISHAN CORPORATION
# COMPLETE PRODUCTION-READY FRESH PRODUCE ERP,
# INVENTORY, PROCUREMENT, SALES, FLEET & LOGISTICS SYSTEM

============================================================
MASTER BUILD INSTRUCTION
============================================================

You are a senior:

- Product Architect
- ERP Domain Expert
- UX/UI Designer
- Full-Stack Engineer
- Database Architect
- Security Engineer
- QA Engineer
- DevOps Engineer

Your task is to inspect the EXISTING PROJECT and finish/upgrade it
into a COMPLETE, REAL, PRODUCTION-READY web application for
Kishan Corporation.

THIS IS NOT:

- A static UI task
- A frontend-only demo
- A Figma prototype
- A mock dashboard
- A collection of disconnected CRUD pages
- A project with fake buttons
- A project with hardcoded business data

THIS MUST BE:

- A real full-stack application
- Connected to the real database
- Fully functional
- Secure
- Responsive
- Role-based
- Auditable
- Transaction-safe
- Production-ready

Use the EXISTING CODEBASE as the source of truth.

Do not rebuild the application from scratch unless genuinely necessary.

============================================================
1. EXISTING TECHNOLOGY STACK
============================================================

Use the existing project stack exactly unless there is a genuine
technical blocker.

Current stack:

- Next.js 16
- App Router
- TypeScript
- React 19
- Tailwind CSS v4
- Prisma
- PostgreSQL
- shadcn/ui
- react-hook-form
- zod
- @tanstack/react-table
- date-fns
- exceljs
- @react-pdf/renderer
- Existing private file/document utilities

Before changing architecture:

1. Read prisma/schema.prisma
2. Read src/lib/auth/permissions.ts
3. Read src/lib/nav-config.ts
4. Read src/lib/actions/*
5. Read src/lib/services/*
6. Inspect existing components
7. Inspect existing routes
8. Inspect existing authentication
9. Inspect existing database services
10. Follow existing coding patterns

Do not create a parallel architecture if an existing project pattern
already exists.

Prefer:

- Server Components for server-side data fetching
- Client Components only when interactivity is required
- Server Actions for mutations where the existing architecture uses them
- Shared services for business logic
- Zod validation
- Prisma transactions
- Existing authentication/authorization utilities

============================================================
2. PRODUCT NAME
============================================================

Kishan Corporation

Fresh Produce Procurement, Inventory, Sales,
Fleet & Logistics Management System

The application should feel like professional enterprise ERP software.

============================================================
3. CORE BUSINESS WORKFLOW
============================================================

The complete business flow is:

VENDOR
    ↓
PROCUREMENT
    ↓
VEHICLE GATE ENTRY
    ↓
UNLOADING
    ↓
PROCUREMENT BATCH
    ↓
SORTING
    ↓
GRADING
    ↓
WASTAGE
    ↓
AVAILABLE INVENTORY
    ↓
SALES ORDER
    ↓
STOCK CHECK
    ↓
DISPATCH PLANNING
    ↓
VEHICLE + DRIVER
    ↓
LOADING
    ↓
TRIP
    ↓
CUSTOMER DELIVERY
    ↓
EMPTY CRATE RETURN
    ↓
VEHICLE RETURN
    ↓
CLEANING
    ↓
SHIFT HANDOVER
    ↓
NEXT-DAY PREPARATION

Parallel vehicle workflow:

VEHICLE
    ↓
FUEL
    ↓
MAINTENANCE
    ↓
DOCUMENT EXPIRY
    ↓
DISPATCH ELIGIBILITY

Parallel driver workflow:

DRIVER
    ↓
DRIVING LICENCE
    ↓
AADHAAR
    ↓
PAN
    ↓
OTHER DOCUMENTS
    ↓
VEHICLE ASSIGNMENT
    ↓
TRIP

Parallel workforce workflow:

EMPLOYEE / LABOUR
    ↓
SHIFT
    ↓
ATTENDANCE
    ↓
OVERTIME
    ↓
SALARY

============================================================
4. PRODUCT MODULES
============================================================

The final system must include:

1. Dashboard
2. Vegetable / Item Master
3. Categories
4. Warehouses
5. Storage Locations
6. Vendors
7. Procurement
8. Procurement Batches
9. Gate Entry
10. Unloading
11. Sorting
12. Grading
13. Wastage
14. Storage Temperature
15. Inventory
16. Inventory Ledger
17. Stock Inward
18. Stock Outward
19. Stock Transfer
20. Stock Adjustment
21. Purchase Orders
22. Sales Orders
23. Dispatch Planning
24. Trips
25. Routes
26. Route Clusters
27. Vehicle Management
28. Vehicle Documents
29. Driver Management
30. Driver Documents
31. Fuel Management
32. Vehicle Maintenance
33. Crate Management
34. Empty Crate Returns
35. Return Processing
36. Dumping / Disposal
37. Cleaning
38. Shift Management
39. Shift Handover
40. Next-Day Preparation
41. Employee Management
42. Labour Management
43. Attendance
44. Salary / Payroll
45. Reports
46. Notifications
47. Documents
48. User Management
49. Roles
50. Permissions
51. Approvals
52. Audit Log
53. Global Search
54. Barcode / QR Scan
55. System Settings
56. Profile / Account Settings

============================================================
5. EXISTING ROUTES
============================================================

Preserve and finish existing routes.

Existing/partially implemented:

/dashboard

/items
/items/new
/items/[id]
/items/[id]/edit

/categories

/warehouses
/warehouses/[id]

/stock/inward
/stock/inward/new
/stock/inward/[id]
/stock/inward/[id]/edit
/stock/inward/[id]/print

/stock/outward
/stock/outward/new
/stock/outward/[id]

/stock/transfer
/stock/transfer/new
/stock/transfer/[id]

/stock/adjustment
/stock/adjustment/new
/stock/adjustment/[id]

/purchase-orders
/purchase-orders/new
/purchase-orders/[id]
/purchase-orders/[id]/print

/suppliers
/suppliers/[id]

/vehicles
/vehicles/[id]

/gate
/gate/[entryId]/print

/fuel
/fuel/new

/maintenance
/maintenance/new

/storage-temperature

/settings/users
/settings/roles
/settings/roles/[id]

============================================================
6. REQUIRED ROUTES
============================================================

Ensure these routes exist and work:

/inventory-ledger

/scan

/drivers
/drivers/new
/drivers/[id]
/drivers/[id]/edit
/drivers/[id]/documents

/reports

/notifications

/documents

/settings
/settings/audit-log

Also create appropriate routes for the new Kishan Corporation
business modules where they do not already exist:

/procurement
/procurement/new
/procurement/[id]

/procurement/batches
/procurement/batches/[id]

/procurement/unloading
/procurement/sorting
/wastage

/sales/orders
/sales/orders/new
/sales/orders/[id]

/dispatch
/dispatch/trips/[id]

/routes

/crates
/crates/returns

/operations/returns
/operations/dumping
/operations/cleaning
/operations/shifts
/operations/next-day

/employees
/employees/[id]

/labour

/attendance

/payroll

Ensure sidebar links point only to real working routes.

No 404 routes.

============================================================
7. GLOBAL APPLICATION LAYOUT
============================================================

Desktop:

LEFT SIDEBAR:

Dashboard
Procurement
Inventory
Sales
Dispatch
Vehicles
Drivers
Crates
Operations
Employees
Reports
Notifications
Administration
Settings

TOP HEADER:

- Breadcrumbs
- Global search
- Notifications
- User profile
- Current user
- Logout

Sidebar:

- Expand
- Collapse

Mobile:

- Mobile drawer
- Touch-friendly navigation
- Important modules easily accessible
- Responsive forms
- Responsive tables
- No unusable horizontal scrolling

============================================================
8. GLOBAL UX/UI DESIGN
============================================================

Create a premium enterprise SaaS interface.

Design characteristics:

- Professional
- Modern
- Clean
- High information density
- Easy to understand
- Fast
- Responsive
- Accessible
- Consistent

Do not overuse:

- Glassmorphism
- Gradients
- 3D decorations
- Excessive animations
- Decorative effects

Use subtle animation only when useful.

Use:

- Cards
- Tables
- Tabs
- Drawers
- Dialogs
- Confirmation dialogs
- Status badges
- Charts
- Timeline
- Toasts
- Skeleton loaders
- Empty states
- Error states

Every page must have:

- Loading state
- Empty state
- Error state
- Success feedback

============================================================
9. DASHBOARD PAGE
============================================================

Route:

/dashboard

Create an executive operational dashboard.

PROCUREMENT KPIs:

- Today's procurement
- Inbound weight
- Purchase value
- Active vendors

SORTING KPIs:

- Raw weight
- Sorted weight
- Grade A
- Grade B
- Grade C
- Wastage
- Yield percentage

INVENTORY KPIs:

- Total stock
- Available stock
- Low stock
- Out of stock
- Stock value

SALES KPIs:

- Today's orders
- Pending orders
- Approved orders
- Ready for dispatch

DISPATCH KPIs:

- Today's trips
- Loading
- Dispatched
- Returned

FLEET KPIs:

- Total vehicles
- Available
- On trip
- Inside
- Outside
- Under maintenance

DRIVER KPIs:

- Active drivers
- Available drivers
- Expiring licences

CRATE KPIs:

- Total crates
- Available
- With customers
- Returned
- Damaged
- Missing

WORKFORCE KPIs:

- Employees present
- Labour present
- Current shift

ALERTS:

- Low stock
- Out of stock
- Document expiry
- Expired documents
- High wastage
- Temperature alert
- Fuel anomaly
- Maintenance due
- Pending approval
- Pending dispatch
- Overdue crate return

CHARTS:

- Procurement trend
- Inventory movement
- Sales trend
- Wastage trend
- Grade distribution
- Dispatch trend
- Fuel expense
- Maintenance expense

TABLES:

- Recent transactions
- Low-stock items
- Pending approvals
- Expiring documents
- Fuel anomalies
- Temperature alerts

Every number must come from the real database.

Every meaningful KPI should be clickable.

============================================================
10. VEGETABLE / ITEM MASTER
============================================================

Routes:

/items
/items/new
/items/[id]
/items/[id]/edit

Support:

- List
- Create
- Edit
- Detail
- Search
- Filter
- Sort
- Pagination
- Import
- Export
- QR
- Barcode
- Attachments
- Stock indicators

Fields:

- Item/Vegetable ID
- SKU
- Item Code
- Vegetable Name
- Category
- Subcategory
- Brand where applicable
- Description
- Unit
- Minimum Stock
- Maximum Stock
- Reorder Level
- Storage Temperature Minimum
- Storage Temperature Maximum
- Storage Type
- Storage Location
- Shelf Life
- Active/Inactive
- Image
- Attachments

Do not allow direct manual current-stock overwriting.

============================================================
11. VEGETABLE DETAIL PAGE
============================================================

Route:

/items/[id]

Tabs:

Overview
Inventory
Procurement
Sorting
Wastage
Sales
Storage
Temperature
History

Overview:

- Basic details
- Current stock
- Reorder status
- Storage requirements

Inventory:

- Warehouse-wise stock
- Batch-wise stock
- Grade-wise stock

Procurement:

- Vendor history
- Purchase history
- Purchase prices

Sorting:

- Raw weight
- Sorted weight
- Grade A
- Grade B
- Grade C
- Waste

Sales:

- Sales history

Temperature:

- Required range
- Recorded temperature
- History
- Alerts

History:

- All important transactions

============================================================
12. CATEGORY MANAGEMENT
============================================================

Route:

/categories

Support:

- List
- Add
- Edit
- Archive
- Parent category
- Child category
- Active/inactive

Prevent invalid circular parent relationships.

============================================================
13. WAREHOUSE MANAGEMENT
============================================================

Routes:

/warehouses
/warehouses/[id]

Warehouse fields:

- Warehouse ID
- Name
- Code
- Address
- Manager
- Contact
- Status

Location hierarchy:

Warehouse
→ Rack
→ Shelf
→ Bin

Detail page:

- Current stock
- Capacity where applicable
- Items
- Batches
- Storage locations
- Temperature
- Recent movements

============================================================
14. VENDOR MANAGEMENT
============================================================

Routes:

/suppliers
/suppliers/[id]

Fields:

- Vendor ID
- Vendor name
- Contact person
- Mobile
- Email
- Address
- Location
- GST information where applicable
- PAN only where legitimately required
- Documents
- Status

Detail:

- Procurement history
- Items supplied
- Quantity
- Purchase value
- Quality history
- Wastage history

============================================================
15. PROCUREMENT ENTRY
============================================================

Routes:

/procurement
/procurement/new
/procurement/[id]

Create a complete procurement workflow.

Fields:

- Procurement ID
- Date
- Time
- Vendor
- Vendor location
- Vehicle
- Driver
- Gate Entry
- Warehouse
- Purchase reference
- Invoice
- Unloading information
- Unloading staff
- Remarks
- Attachments

Line items:

- Vegetable
- Quantity
- Unit
- Weight
- Quality
- Grade
- Purchase price
- Total

Actions:

- Save Draft
- Submit
- Cancel

On submission:

- Create procurement
- Create procurement batch
- Link vendor
- Link vehicle
- Link driver
- Link gate entry
- Link item
- Store raw quantity/weight
- Create audit record

============================================================
16. PROCUREMENT BATCHES
============================================================

Routes:

/procurement/batches
/procurement/batches/[id]

Batch fields:

- Batch ID
- Procurement ID
- Vendor
- Vegetable
- Raw weight
- Quality
- Date
- Vehicle
- Driver
- Gate Entry
- Status

Detail page must show complete traceability.

============================================================
17. BATCH TRACEABILITY
============================================================

For every batch show:

Vendor
↓
Vehicle
↓
Driver
↓
Gate Entry
↓
Procurement
↓
Raw Weight
↓
Unloading
↓
Sorting
↓
Grade
↓
Wastage
↓
Inventory
↓
Sales Order
↓
Dispatch
↓
Trip
↓
Customer

This should be a visual timeline.

Show:

- Raw quantity
- Sorted quantity
- Waste
- Yield
- Remaining quantity
- Related inventory
- Related sales
- Related dispatches

============================================================
18. GATE ENTRY / EXIT
============================================================

Route:

/gate

Support:

- Gate entry list
- Vehicle currently inside
- Record entry
- Record exit
- Print gate pass

Entry fields:

- Gate Entry Number
- Vehicle
- Driver
- Vendor
- Purpose
- Material
- Procurement
- Time In
- Security Staff
- Remarks

Exit fields:

- Gate Exit Number
- Vehicle
- Driver
- Time Out
- Destination
- Material
- Receiver
- Remarks

Calculate time inside premises.

Update vehicle status appropriately.

============================================================
19. UNLOADING
============================================================

Route:

/procurement/unloading

Show vehicles awaiting unloading.

Fields:

- Gate Entry
- Vehicle
- Driver
- Vendor
- Arrival
- Unloading start
- Unloading end
- Weight
- Unloading staff
- Remarks

Calculate unloading duration.

============================================================
20. SORTING & GRADING
============================================================

Route:

/procurement/sorting

Show pending procurement batches.

Sorting fields:

- Batch
- Vegetable
- Raw weight
- Grade A
- Grade B
- Grade C
- Other grade if configured
- Waste
- Waste reason
- Sorting staff
- Date/time
- Remarks

Critical validation:

Grade A
+ Grade B
+ Grade C
+ Other grades
+ Waste

MUST equal:

Raw Weight

Do not allow completion if totals do not match.

Automatically calculate:

- Sorted weight
- Waste quantity
- Waste %
- Yield %

Example:

Raw = 1000 KG

A = 600
B = 250
C = 80
Waste = 70

Total = 1000 KG

============================================================
21. WASTAGE MANAGEMENT
============================================================

Route:

/wastage

Fields:

- Wastage ID
- Batch
- Vegetable
- Quantity
- Reason
- Disposal method
- Date
- Recorded by
- Approval
- Remarks

Reasons:

- Damaged
- Rotten
- Quality rejection
- Handling damage
- Expired
- Other

Reports:

- Daily
- Vegetable-wise
- Vendor-wise
- Batch-wise
- Percentage

Wastage must create inventory traceability.

============================================================
22. STORAGE TEMPERATURE
============================================================

Route:

/storage-temperature

Each vegetable supports:

- Minimum temperature
- Maximum temperature
- Storage type
- Storage location
- Shelf life

Temperature record:

- Item
- Batch
- Warehouse
- Location
- Current temperature
- Date/time
- Recorded by

Statuses:

NORMAL
WARNING
CRITICAL

Show:

- Current conditions
- Temperature alerts
- Batches at risk
- History chart
- Filters
- Export

Create the architecture so future IoT sensors can be integrated.

Do not claim real hardware integration unless actual hardware exists.

============================================================
23. INVENTORY
============================================================

Route:

/inventory

Show:

- Total stock
- Raw stock
- Sorted stock
- Grade A
- Grade B
- Grade C
- Warehouse stock
- Batch stock
- Low stock
- Out of stock

Filters:

- Vegetable
- Category
- Warehouse
- Batch
- Grade
- Date

============================================================
24. INVENTORY ENGINE
============================================================

Inventory must be transaction-driven.

Do NOT manually overwrite stock.

Business calculation:

Opening Stock
+ valid procurement/sorted stock
+ transfer in
+ positive adjustment
- outward/dispatch
- wastage
- disposal
- transfer out
- negative adjustment

= Available Stock

Use database transactions.

Prevent negative stock unless explicitly configured and authorized.

============================================================
25. INVENTORY LEDGER
============================================================

Route:

/inventory-ledger

Columns:

- Ledger ID
- Date/time
- Item
- Batch
- Warehouse
- Transaction type
- Reference number
- Quantity in
- Quantity out
- Before quantity
- After quantity
- User

Transaction types:

PROCUREMENT
SORTING
WASTAGE
SALE
DISPATCH
TRANSFER
ADJUSTMENT
RETURN
DISPOSAL

Support:

- Search
- Filters
- Date range
- Export
- Print

============================================================
26. STOCK INWARD
============================================================

Routes:

/stock/inward
/stock/inward/new
/stock/inward/[id]
/stock/inward/[id]/edit
/stock/inward/[id]/print

Support:

- Draft
- Pending
- Approved
- Received
- Cancelled

Connect to:

- Supplier
- PO
- Vehicle
- Driver
- Warehouse
- Batch
- Items

Stock changes must use the inventory service.

============================================================
27. STOCK OUTWARD
============================================================

Routes:

/stock/outward
/stock/outward/new
/stock/outward/[id]

Fields:

- Outward number
- Date
- Warehouse
- Sales order
- Customer
- Item
- Batch
- Grade
- Quantity
- Weight
- Requested by
- Approved by
- Purpose
- Destination
- Receiver
- Vehicle
- Driver
- Remarks

Before issue:

- Validate permission
- Validate status
- Validate stock
- Validate batch
- Validate grade

Workflow:

DRAFT
→ PENDING APPROVAL
→ APPROVED
→ ISSUED
→ COMPLETED

Never allow negative stock.

============================================================
28. STOCK TRANSFER
============================================================

Routes:

/stock/transfer
/stock/transfer/new
/stock/transfer/[id]

Fields:

- Transfer ID
- Source warehouse
- Destination warehouse
- Item
- Batch
- Grade
- Quantity
- Requested by
- Approved by
- Date
- Remarks

Workflow:

DRAFT
→ REQUESTED
→ APPROVED
→ DISPATCHED
→ RECEIVED

Inventory must update at the correct stages.

============================================================
29. STOCK ADJUSTMENT
============================================================

Routes:

/stock/adjustment
/stock/adjustment/new
/stock/adjustment/[id]

Fields:

- Item
- Batch
- Warehouse
- System quantity
- Physical quantity
- Difference
- Reason
- Attachment
- Requested by
- Approved by

Never silently overwrite stock.

Create:

- Adjustment transaction
- Inventory ledger
- Audit log

============================================================
30. PURCHASE ORDERS
============================================================

Routes:

/purchase-orders
/purchase-orders/new
/purchase-orders/[id]
/purchase-orders/[id]/print

Fields:

- PO number
- Supplier
- Date
- Expected delivery
- Items
- Quantity
- Rate
- Tax
- Total
- Remarks

Statuses:

DRAFT
PENDING APPROVAL
APPROVED
PARTIALLY RECEIVED
RECEIVED
CANCELLED

Track received quantity.

Connect PO to procurement/inward.

============================================================
31. SALES ORDERS
============================================================

Routes:

/sales/orders
/sales/orders/new
/sales/orders/[id]

Fields:

- Sales Order ID
- Customer
- Customer location
- Order date
- Delivery date
- Priority
- Items
- Grade
- Quantity
- Rate
- Total
- Remarks
- Attachments

Automatically calculate totals.

Show:

- Ordered quantity
- Available quantity
- Fulfilled quantity
- Pending quantity
- Dispatch status

Workflow:

DRAFT
→ PENDING
→ APPROVED
→ READY FOR DISPATCH
→ PARTIALLY FULFILLED
→ COMPLETED
→ CANCELLED

============================================================
32. DISPATCH PLANNING
============================================================

Route:

/dispatch

Show:

- Pending dispatch
- Today's dispatch
- Loading
- Dispatched
- Returned

Create dispatch:

- Trip ID
- Sales Order
- Customer
- Route
- Route Cluster
- Vehicle
- Driver
- Loading van
- Loading staff
- Departure time
- Expected arrival
- Items
- Grade
- Quantity
- Crates
- Remarks

Before assigning:

Check dispatch eligibility.

============================================================
33. DISPATCH ELIGIBILITY ENGINE
============================================================

Before dispatch, automatically check:

VEHICLE:

- Active
- Available
- Not on another trip
- Not under maintenance
- Insurance valid
- PUC valid
- Fitness valid
- Registration valid
- Permit valid where required

DRIVER:

- Active
- Available
- Licence valid
- Required licence class
- Not already on active trip

INVENTORY:

- Required stock exists
- Correct grade exists
- Correct quantity exists

If a critical requirement fails:

BLOCK DISPATCH.

Show exact reason.

Example:

"Dispatch blocked:
Vehicle insurance expired."

Authorized override may be allowed only according to business rules.

Every override must create an audit record.

============================================================
34. TRIP MANAGEMENT
============================================================

Route:

/dispatch/trips/[id]

Show:

- Trip ID
- Vehicle
- Driver
- Customer
- Route
- Cluster
- Items
- Quantity
- Loading
- Departure
- Delivery
- Return
- Crates

Timeline:

CREATED
→ APPROVED
→ LOADING
→ LOADED
→ DISPATCHED
→ DELIVERED
→ RETURNED

============================================================
35. ROUTE / CLUSTER MANAGEMENT
============================================================

Route:

/routes

Fields:

- Route ID
- Route name
- Start
- Destination
- Route cluster
- Estimated distance
- Estimated time
- Status

Show route-wise trips.

============================================================
36. VEHICLE MANAGEMENT
============================================================

Routes:

/vehicles
/vehicles/[id]

Vehicle fields:

- Vehicle ID
- Vehicle Number
- Vehicle Type
- Manufacturer
- Model
- Registration Date
- Registration Expiry
- Capacity
- Fuel Type
- Current KM
- Current Driver
- Current Location
- Status
- Vehicle Image
- Documents

Statuses:

AVAILABLE
INSIDE
OUTSIDE
ON_TRIP
UNDER_MAINTENANCE
INACTIVE

Vehicle number must be unique.

============================================================
37. VEHICLE DETAIL
============================================================

Route:

/vehicles/[id]

Tabs:

Overview
Documents
Trips
Fuel
Maintenance
Driver
Gate History
Audit

Overview:

- Vehicle information
- Current location
- Current driver
- Current KM
- Status
- Capacity

Documents:

- Registration
- Insurance
- PUC
- Fitness
- Permit
- Other

Trips:

- Active
- Previous

Fuel:

- Fuel history
- Mileage
- Cost/KM

Maintenance:

- Service history
- Upcoming service
- Costs

============================================================
38. DRIVER MANAGEMENT
============================================================

Routes:

/drivers
/drivers/new
/drivers/[id]
/drivers/[id]/edit

Fields:

- Driver ID
- Employee ID
- Full Name
- Mobile
- Alternate Mobile
- Address
- Date of Birth only if legitimately required
- Joining Date
- Emergency Contact
- Profile Photo
- Status

Table:

- Driver ID
- Name
- Mobile
- Assigned vehicle
- Licence status
- Document status
- Driver status
- Actions

============================================================
39. DRIVER DETAIL
============================================================

Route:

/drivers/[id]

Tabs:

Overview
Documents
Trips
Vehicles
Attendance where applicable
Audit

Show:

- Current vehicle
- Current trip
- Driver status
- Trip history
- Vehicle assignment history
- Document status

============================================================
40. DRIVER DOCUMENTS
============================================================

Route:

/drivers/[id]/documents

Support:

1. Aadhaar
2. PAN
3. Driving Licence
4. Address Proof
5. Other configured documents

AADHAAR:

- Aadhaar number
- Aadhaar document
- Verification status

PAN:

- PAN number
- PAN document
- Verification status

DRIVING LICENCE:

- Licence number
- Licence class
- Issue date
- Expiry date
- Issuing authority
- Licence document
- Verification status

IMPORTANT SECURITY:

Aadhaar and PAN are sensitive information.

Do NOT display full numbers in normal UI.

Example:

Aadhaar:
XXXX XXXX 4821

PAN:
XXXXX4821X

Implement:

- Encryption at rest
- Private storage
- Server-side authorization
- Masked values
- Secure temporary document access
- Access logging
- Download logging
- No sensitive data in URLs
- No sensitive data in normal application logs
- No public document URLs
- Retention/deletion controls

Create permission:

VIEW_SENSITIVE_DRIVER_DOCUMENTS

Only authorized users can view sensitive information.

Make document collection configurable.

Do not use real identity documents in seed/demo data.

============================================================
41. DOCUMENT EXPIRY
============================================================

Route:

/documents

Also provide expiry filtering.

Track:

- Driving Licence
- Insurance
- PUC
- Registration
- Fitness
- Permit
- Other

Show:

EXPIRED
7 DAYS
15 DAYS
30 DAYS
60 DAYS

Generate notifications.

============================================================
42. VEHICLE FUEL MANAGEMENT
============================================================

Routes:

/fuel
/fuel/new

Fuel fields:

- Fuel ID
- Vehicle
- Driver
- Trip
- Date
- Time
- Fuel station
- Fuel type
- Previous odometer
- Current odometer
- Distance
- Fuel quantity
- Fuel rate
- Total fuel cost
- Receipt
- Remarks

Calculate:

Distance =
Current KM - Previous KM

Fuel cost =
Fuel quantity × Fuel rate

Mileage =
Distance ÷ Fuel quantity

Fuel cost/KM =
Fuel cost ÷ Distance

Show:

- Vehicle-wise history
- Driver-wise history
- Trip-wise history
- Monthly expense
- Mileage
- Cost/KM

Detect unusual fuel consumption.

Do not silently delete fuel entries.

Use void/archive with reason and audit.

============================================================
43. VEHICLE MAINTENANCE
============================================================

Routes:

/maintenance
/maintenance/new

Fields:

- Maintenance ID
- Vehicle
- Maintenance type
- Service date
- Odometer KM
- Service center
- Technician
- Work performed
- Parts replaced
- Labour cost
- Parts cost
- Other cost
- Total cost
- Next service date
- Next service KM
- Invoice
- Remarks

Types:

Regular Service
Preventive Maintenance
Oil Change
Tyre Replacement
Brake Service
Engine Repair
Electrical Repair
Accident Repair
Emergency Repair
Other

Statuses:

UP TO DATE
DUE SOON
DUE
OVERDUE

If critical maintenance is overdue:

BLOCK DISPATCH

unless authorized override is permitted.

============================================================
44. CRATE MANAGEMENT
============================================================

Route:

/crates

Track:

- Crate ID
- Crate type
- Capacity
- Status
- Current location
- Customer
- Condition

Statuses:

AVAILABLE
LOADED
WITH_CUSTOMER
RETURNED
DAMAGED
MISSING
CLEANING
READY

============================================================
45. CRATE DISPATCH
============================================================

Connect crates to trips.

Record:

- Trip
- Customer
- Vehicle
- Driver
- Crates loaded
- Date

============================================================
46. EMPTY CRATE RETURN
============================================================

Route:

/crates/returns

Fields:

- Return ID
- Trip
- Customer
- Vehicle
- Driver
- Crates dispatched
- Crates returned
- Damaged
- Missing
- Return date
- Condition
- Remarks

Calculate:

Pending =
Dispatched
- Returned
- Damaged/Missing

Create overdue alerts.

============================================================
47. RETURN PROCESSING
============================================================

Route:

/operations/returns

Support:

- Empty crate return
- Vegetable/material return
- Dumping
- Cleaning
- Shift change
- Next-day preparation

Fields:

- Trip
- Vehicle
- Driver
- Return time
- Material returned
- Crates
- Waste
- Cleaning status
- Staff
- Shift
- Remarks

============================================================
48. DUMPING / DISPOSAL
============================================================

Route:

/operations/dumping

Fields:

- Disposal ID
- Item
- Batch
- Quantity
- Reason
- Disposal method
- Date
- Employee
- Approval
- Remarks

Never remove inventory without a traceable transaction.

============================================================
49. CLEANING
============================================================

Route:

/operations/cleaning

Track:

- Vehicle
- Crate
- Location where applicable
- Cleaning type
- Start time
- End time
- Staff
- Status
- Remarks

Statuses:

PENDING
IN_PROGRESS
COMPLETED

============================================================
50. SHIFT MANAGEMENT
============================================================

Route:

/operations/shifts

Fields:

- Shift ID
- Shift name
- Start time
- End time
- Supervisor
- Employees
- Status

Support:

- Shift creation
- Shift assignment
- Shift status
- Shift handover

============================================================
51. SHIFT HANDOVER
============================================================

At shift change show:

- Previous supervisor
- New supervisor
- Pending procurement
- Pending unloading
- Pending sorting
- Pending dispatch
- Stock issues
- Vehicles inside
- Vehicles outside
- Cleaning status
- Crate status
- Pending tasks
- Remarks
- Handover time

============================================================
52. NEXT-DAY PREPARATION
============================================================

Route:

/operations/next-day

Checklist:

- Vehicle availability
- Driver availability
- Crates ready
- Cleaning completed
- Inventory ready
- Pending orders
- Procurement plan
- Dispatch plan
- Warehouse preparation
- Staff allocation

Actions:

- Assign
- Complete
- Reopen
- Add remark

============================================================
53. EMPLOYEE MANAGEMENT
============================================================

Routes:

/employees
/employees/[id]

Fields:

- Employee ID
- Name
- Mobile
- Department
- Role
- Joining date
- Shift
- Status
- Documents

Actions:

- View
- Edit
- Assign shift
- Attendance
- Salary
- Archive

============================================================
54. LABOUR MANAGEMENT
============================================================

Route:

/labour

Fields:

- Labour ID
- Name
- Mobile
- Work type
- Daily wage
- Shift
- Status

Track:

- Attendance
- Working days
- Overtime
- Advance
- Payable salary

============================================================
55. ATTENDANCE
============================================================

Route:

/attendance

Fields:

- Date
- Employee/Labour
- Shift
- Present
- Absent
- Half Day
- Overtime
- Remarks

Filters:

- Date
- Employee
- Department
- Shift
- Status

============================================================
56. SALARY / PAYROLL
============================================================

Route:

/payroll

For labour:

Daily Wage
× Working Days
+ Overtime
- Advance
- Deductions
= Payable

For employees:

Support configurable salary components.

Do not hardcode statutory payroll rules.

Provide:

- Salary period
- Employee
- Earnings
- Overtime
- Advances
- Deductions
- Net salary
- Payment status

============================================================
57. NOTIFICATIONS
============================================================

Route:

/notifications

Notification types:

- Low stock
- Out of stock
- Expiring licence
- Expired document
- Maintenance due
- Temperature alert
- Fuel anomaly
- Pending approval
- Pending dispatch
- Crate overdue
- High wastage

Support:

- Read/unread
- Mark read
- Mark all read
- Open related record

============================================================
58. REPORT CENTER
============================================================

Route:

/reports

Create categories:

PROCUREMENT
INVENTORY
SORTING
WASTAGE
SALES
DISPATCH
VEHICLES
DRIVERS
CRATES
WORKFORCE
FUEL
MAINTENANCE
TEMPERATURE
DOCUMENTS
AUDIT

Each report must use real database data.

============================================================
59. PROCUREMENT REPORTS
============================================================

Reports:

- Daily procurement
- Vendor-wise
- Vegetable-wise
- Batch-wise
- Purchase price
- Quantity
- Weight
- Quality
- Wastage

Filters:

- Date
- Vendor
- Vegetable
- Vehicle
- Driver
- Quality

============================================================
60. INVENTORY REPORTS
============================================================

Reports:

- Current stock
- Warehouse stock
- Vegetable stock
- Grade stock
- Batch stock
- Ledger
- Movement
- Low stock
- Out of stock
- Wastage
- Disposal

============================================================
61. SALES REPORTS
============================================================

Reports:

- Sales orders
- Customer-wise sales
- Vegetable-wise sales
- Pending orders
- Completed orders
- Dispatch value
- Quantity sold

============================================================
62. DISPATCH REPORTS
============================================================

Reports:

- Daily trips
- Vehicle-wise
- Driver-wise
- Customer-wise
- Route-wise
- Loading
- Delivery
- Returns

============================================================
63. FLEET REPORTS
============================================================

Reports:

- Vehicle list
- Vehicle utilization
- Fuel
- Mileage
- Fuel cost/KM
- Maintenance
- Maintenance cost
- Service history
- Upcoming service
- Overdue service
- Document expiry

============================================================
64. DRIVER REPORTS
============================================================

Reports:

- Driver list
- Assigned vehicles
- Trip history
- Licence expiry
- Document status
- Driver activity

Sensitive information must respect permissions.

============================================================
65. CRATE REPORTS
============================================================

Reports:

- Available
- With customers
- Returned
- Missing
- Damaged
- Overdue
- Customer-wise crate balance

============================================================
66. WORKFORCE REPORTS
============================================================

Reports:

- Attendance
- Labour attendance
- Employee attendance
- Overtime
- Salary
- Labour cost
- Department workforce

============================================================
67. EXPORT SYSTEM
============================================================

Authorized reports should support:

- CSV
- Excel
- PDF
- Print

Use existing:

- exceljs
- @react-pdf/renderer

Exports must respect permissions.

Sensitive exports require appropriate permission.

============================================================
68. GLOBAL SEARCH
============================================================

Create global search.

Search:

- Vegetable
- Item code
- SKU
- Batch
- Vendor
- Procurement
- PO
- Sales Order
- Vehicle
- Driver
- Trip
- Crate
- Employee
- Labour

Show grouped results.

============================================================
69. BARCODE / QR SCAN
============================================================

Route:

/scan

Support:

- Manual barcode input
- Manual QR payload input
- Item code
- SKU
- Barcode

Show:

- Matched item
- Current stock
- Warehouse
- Batch
- Recent movement

If camera scanning is not actually implemented,
do not claim that camera scanning works.

Do not expose sensitive information through QR codes.

============================================================
70. DOCUMENT MANAGEMENT
============================================================

Route:

/documents

Support:

- Search
- Filter by entity
- Filter by document type
- Filter by expiry
- Preview
- Secure download
- Archive
- Version where appropriate
- Access history

Private document storage only.

============================================================
71. USER MANAGEMENT
============================================================

Route:

/settings/users

Support:

- User list
- Create
- Edit
- Disable
- Role assignment
- Password reset flow if supported
- Active/inactive

============================================================
72. ROLES & PERMISSIONS
============================================================

Routes:

/settings/roles
/settings/roles/[id]

Roles:

SUPER_ADMIN
STORE_MANAGER
STORE_OPERATOR
VEHICLE_MANAGER
GATE_OPERATOR
AUDITOR
MANAGEMENT
HR/PAYROLL where required

Permissions:

VIEW
CREATE
EDIT
ARCHIVE
APPROVE
EXPORT
PRINT
UPLOAD_DOCUMENT
DOWNLOAD_DOCUMENT
VIEW_SENSITIVE_DOCUMENT
MANAGE_USERS
MANAGE_SETTINGS

Permissions must be checked SERVER-SIDE.

Do not rely only on hiding frontend buttons.

============================================================
73. APPROVAL CENTER
============================================================

Create approval functionality for:

- Stock Outward
- Stock Adjustment
- Purchase Order
- Stock Transfer
- Other configured workflows

Each approval contains:

- Requester
- Request date
- Entity
- Details
- Approve
- Reject
- Comment
- Approval history

============================================================
74. AUDIT LOG
============================================================

Route:

/settings/audit-log

Track:

- Login
- Logout
- Create
- Update
- Archive
- Approve
- Reject
- Stock adjustment
- Document access
- Document download
- Sensitive document access
- Export
- User changes
- Permission changes
- Settings changes
- Override actions

Audit records must not be deletable by normal users.

============================================================
75. SYSTEM SETTINGS
============================================================

Route:

/settings

Sections:

Company:

- Company name
- Logo
- Address
- Contact

Inventory:

- Negative stock policy
- Reorder rules
- Units
- Grades

Numbering:

- Procurement
- Batch
- PO
- Sales Order
- Trip
- Vehicle
- Driver
- Crate

Notifications:

- Document expiry days
- Low stock thresholds
- Crate overdue threshold
- Temperature thresholds

Security:

- Session settings
- Password rules
- Access settings

Every setting change must be permission-protected and audited.

============================================================
76. PROFILE
============================================================

Route:

/profile

Support:

- View profile
- Edit profile
- Change password
- Profile image
- Account/security information

============================================================
77. DATABASE ARCHITECTURE
============================================================

Use existing schema first.

Only modify schema if genuinely required.

Expected business entities include, where appropriate:

User
Role
Permission
RolePermission

Category
Vegetable/Item
Warehouse
StorageLocation

Vendor
VendorDocument

Procurement
ProcurementItem
ProcurementBatch
GateEntry
GateExit
Unloading

Sorting
SortingGrade
Wastage
Disposal

Inventory
InventoryLedger
StockInward
StockInwardItem
StockOutward
StockOutwardItem
StockTransfer
StockTransferItem
StockAdjustment
StockAdjustmentItem

PurchaseOrder
PurchaseOrderItem

SalesOrder
SalesOrderItem

Dispatch
DispatchItem
Trip
Route
RouteCluster

Vehicle
VehicleDocument
VehicleFuel
VehicleMaintenance

Driver
DriverDocument
DriverVehicleAssignment

Crate
CrateMovement
CrateReturn

Cleaning
Shift
ShiftHandover
NextDayPreparation

Employee
Labour
Attendance
Salary

Notification
Approval
AuditLog
Attachment
SystemSetting

Do not duplicate existing models if equivalents already exist.

============================================================
78. DATABASE INTEGRITY
============================================================

Use:

- Primary keys
- Foreign keys
- Unique constraints
- Proper indexes
- Timestamps
- Soft delete/archive where appropriate
- Referential integrity

Important searchable fields must have indexes.

Examples:

- Item code
- SKU
- Vehicle number
- Driver ID
- Vendor ID
- Batch ID
- PO number
- Sales order
- Trip ID

============================================================
79. INVENTORY TRANSACTION SAFETY
============================================================

Every stock-changing operation must be atomic.

Example Stock Outward:

1. Authenticate user
2. Check permission
3. Validate request
4. Validate transaction status
5. Check inventory
6. Lock/check relevant inventory
7. Create outward record
8. Create ledger entries
9. Update inventory state if applicable
10. Create audit record
11. Commit

If anything fails:

ROLLBACK EVERYTHING.

Prevent race conditions.

============================================================
80. SECURITY
============================================================

Implement:

- Secure authentication
- Password hashing
- Session security
- Server-side authorization
- Input validation
- SQL injection protection
- XSS protection
- CSRF protection where applicable
- Rate limiting where appropriate
- Secure headers
- File validation
- Private file storage
- Error sanitization
- Environment variables
- Audit logging

Never expose database stack traces to users.

Never put secrets in source code.

============================================================
81. SENSITIVE DOCUMENT SECURITY
============================================================

For:

- Aadhaar
- PAN
- Driving Licence
- Other sensitive documents

Use:

- Encryption at rest
- Private storage
- Strict server-side permissions
- Masked UI
- Temporary signed access
- Access logging
- Download logging
- No sensitive data in URLs
- No sensitive data in application logs
- No public document URLs

Do not use real personal identity documents in demo data.

============================================================
82. FILE UPLOAD SECURITY
============================================================

Validate:

- MIME type
- File extension
- File size
- File name
- User permission

Use private storage.

Do not expose files publicly.

If the existing project supports malware scanning,
use it for uploaded files.

============================================================
83. NUMBER GENERATION
============================================================

Generate unique IDs.

Examples:

VEG-000001
VEN-000001
PROC-2026-000001
BAT-2026-000001
INW-2026-000001
OUT-2026-000001
TRF-2026-000001
PO-2026-000001
SO-2026-000001
TRIP-2026-000001
VEH-000001
DRV-000001
CRT-000001
EMP-000001
LAB-000001

Never require manual numbering.

Use existing numbering service if already implemented.

============================================================
84. IMPORT SYSTEM
============================================================

Support authorized import for:

- Items/Vegetables
- Vendors
- Vehicles
- Drivers
- Employees
- Labour

Use Excel/CSV.

Validate all rows.

Show:

- Successful rows
- Failed rows
- Validation errors
- Import summary

Do not corrupt existing data.

============================================================
85. DATA TABLE STANDARD
============================================================

All major list pages should support:

- Search
- Filters
- Sorting
- Pagination
- Column visibility where useful
- Date range
- Export where permitted
- Row actions

Use server-side pagination for large datasets.

============================================================
86. EMPTY / LOADING / ERROR STATES
============================================================

Every page must have professional:

Loading state
Empty state
Error state
Success state

Example:

"No procurement records found."

"No vehicles are currently under maintenance."

"No pending approvals."

============================================================
87. CONFIRMATION DIALOGS
============================================================

Require confirmation before:

- Archive
- Cancel
- Reject
- Stock adjustment
- Void
- Document deletion
- User disable
- Important overrides

Ask for reason where appropriate.

============================================================
88. SOFT DELETE / VOID
============================================================

Do not permanently delete critical business records.

Prefer:

- Archive
- Cancel
- Void

with:

- Reason
- User
- Timestamp
- Audit log

============================================================
89. PERFORMANCE
============================================================

Use:

- Database indexes
- Server-side pagination
- Efficient queries
- Lazy loading
- Caching where useful
- Optimized dashboard queries

Do not load thousands of records unnecessarily.

============================================================
90. RESPONSIVE DESIGN
============================================================

Must work correctly on:

- Desktop
- Laptop
- Tablet
- Mobile

Mobile:

- Touch-friendly
- Responsive forms
- Responsive tables
- Compact navigation
- No broken layouts

============================================================
91. ACCESSIBILITY
============================================================

Use:

- Semantic HTML
- Keyboard navigation
- Proper labels
- Accessible dialogs
- Focus management
- Good contrast
- Appropriate ARIA

============================================================
92. TESTING
============================================================

Create tests for:

Authentication
Authorization
Procurement
Batch creation
Sorting
Grading
Wastage
Inventory
Stock inward
Stock outward
Transfers
Adjustments
Sales
Dispatch
Vehicles
Drivers
Documents
Crates
Fuel
Maintenance
Attendance
Payroll
Notifications
Reports

Critical tests:

1. Procurement creates correct batch.
2. Sorting totals equal raw weight.
3. Wastage is calculated correctly.
4. Inventory updates correctly.
5. Negative stock is prevented.
6. Transfer works correctly.
7. Sales order connects to dispatch.
8. Dispatch validates vehicle.
9. Dispatch validates driver.
10. Maintenance restriction works.
11. Expired licence generates alert.
12. Expired vehicle documents generate alert.
13. Crate balance is correct.
14. Fuel mileage is correct.
15. Fuel cost/KM is correct.
16. Audit logs are generated.
17. Unauthorized users cannot access sensitive documents.
18. Aadhaar/PAN values are masked.
19. Approval permissions work.
20. Reports match database data.
21. Temperature alerts work.
22. Wastage cannot exceed raw quantity.
23. A vehicle cannot be assigned to two conflicting active trips.
24. A driver cannot be assigned to conflicting active trips.

============================================================
93. DEVELOPMENT SEED DATA
============================================================

Create realistic DEVELOPMENT seed data.

Include:

- Vegetables
- Categories
- Vendors
- Warehouses
- Storage locations
- Procurement batches
- Sorting
- Grades
- Wastage
- Inventory
- Sales orders
- Trips
- Routes
- Vehicles
- Drivers
- Crates
- Employees
- Labour
- Attendance
- Salary
- Notifications

Use ONLY FAKE development data.

Never use real Aadhaar,
real PAN,
real driving licence,
real personal documents,
real passwords,
or real sensitive information.

============================================================
94. DEVELOPMENT USERS
============================================================

Create development-only users for:

SUPER_ADMIN
STORE_MANAGER
STORE_OPERATOR
VEHICLE_MANAGER
GATE_OPERATOR
AUDITOR
MANAGEMENT

Clearly mark development credentials.

Never put production credentials into source code.

============================================================
95. NO FAKE FUNCTIONALITY
============================================================

ABSOLUTELY DO NOT:

- Hardcode dashboard numbers
- Hardcode charts
- Fake CRUD
- Fake login
- Fake document upload
- Fake notifications
- Fake reports
- Fake inventory calculations
- Fake search
- Fake approvals
- Use localStorage as the primary database
- Create buttons that do nothing
- Create "Coming Soon" placeholders for required functionality

All important features must use real backend logic.

============================================================
96. EXISTING CODEBASE RULE
============================================================

Do not replace working existing functionality unnecessarily.

Before changing anything:

- Inspect existing implementation.
- Reuse existing utilities.
- Reuse existing components.
- Reuse existing services.
- Reuse existing auth.
- Reuse existing permission system.
- Reuse existing navigation patterns.

If the existing schema already supports a requirement,
use it rather than creating duplicate models.

If a genuine blocker exists:

1. Explain the blocker.
2. Make the smallest safe architectural change.
3. Continue all non-blocked work.

============================================================
97. PAGE COMPLETENESS STANDARD
============================================================

For EVERY page, implement all relevant:

- Page header
- Breadcrumb
- KPI cards where useful
- Search
- Filters
- Data table
- Pagination
- Create action
- Edit action
- View action
- Archive/cancel action where appropriate
- Detail page
- Forms
- Validation
- Loading state
- Empty state
- Error state
- Success state
- Permission checks
- Database operations
- Audit logging
- Notifications
- Mobile layout

Do not consider a module complete merely because its list page exists.

============================================================
98. FINAL PAGE-BY-PAGE COMPLETION CHECK
============================================================

Verify every major module has:

LIST PAGE
CREATE PAGE/FORM
DETAIL PAGE
EDIT PAGE where appropriate
FILTERING
SEARCH
VALIDATION
DATABASE
PERMISSIONS
AUDIT
EXPORT where applicable
RESPONSIVE UI

============================================================
99. END-TO-END ACCEPTANCE TEST
============================================================

A complete test should be possible:

1. Login as authorized user.
2. Create vegetable.
3. Create category.
4. Create warehouse.
5. Create storage location.
6. Create vendor.
7. Register vehicle.
8. Register driver.
9. Add driver's Aadhaar/PAN/licence securely using fake data.
10. Record vehicle gate entry.
11. Create procurement.
12. Create procurement batch.
13. Record unloading.
14. Perform sorting.
15. Record Grade A/B/C.
16. Record wastage.
17. Verify yield.
18. Update inventory.
19. Record storage temperature.
20. Create sales order.
21. Approve sales order.
22. Check stock.
23. Create dispatch.
24. Select route.
25. Assign vehicle.
26. Assign driver.
27. Validate dispatch eligibility.
28. Load items.
29. Load crates.
30. Create trip.
31. Complete delivery.
32. Record empty crate return.
33. Record vehicle return.
34. Record cleaning.
35. Perform shift handover.
36. Complete next-day preparation.
37. Record fuel.
38. Record maintenance.
39. Verify maintenance alerts.
40. Verify document expiry alerts.
41. Record employee attendance.
42. Record labour attendance.
43. Calculate salary.
44. Generate reports.
45. Export reports.
46. Search records.
47. View audit history.
48. Verify unauthorized users cannot access restricted data.

============================================================
100. PRODUCTION READINESS
============================================================

Before completion verify:

- No broken routes
- No 404 sidebar links
- No obvious compile errors
- No broken imports
- No fake data
- No placeholder pages
- No unnecessary duplicated architecture
- No insecure public documents
- No sensitive data leakage
- No direct stock overwrite
- No broken transaction logic
- No unauthorized actions
- Reports generate correctly
- Excel export works
- PDF export works
- Mobile layout works
- Desktop layout works
- Database migrations work
- Seed works
- Production build works

============================================================
101. DOCUMENTATION
============================================================

Provide/update:

README

Include:

- Project setup
- Environment variables
- Database setup
- Prisma migration
- Seed command
- Development login
- Storage configuration
- Production build
- Deployment
- Backup recommendations
- Testing commands

Create/update:

.env.example

Never commit real secrets.

============================================================
102. DEVELOPMENT ORDER
============================================================

Follow this order unless the existing codebase requires another safe order.

PHASE 1:
Inspect project
Database
Authentication
Roles
Permissions

PHASE 2:
Vegetables
Categories
Vendors
Warehouses
Locations

PHASE 3:
Procurement
Gate Entry
Unloading
Procurement Batches

PHASE 4:
Sorting
Grading
Wastage
Inventory Engine
Inventory Ledger

PHASE 5:
Purchase Orders
Sales Orders

PHASE 6:
Routes
Dispatch
Trips
Crates
Returns

PHASE 7:
Vehicles
Drivers
Driver Documents
Vehicle Documents

PHASE 8:
Fuel
Maintenance
Dispatch Eligibility

PHASE 9:
Cleaning
Shift
Shift Handover
Next-Day Preparation

PHASE 10:
Employees
Labour
Attendance
Salary

PHASE 11:
Notifications
Documents
Reports
Exports
Audit

PHASE 12:
Search
QR/Barcode
Settings
Performance

PHASE 13:
Testing
Security Review
Responsive Review
Production Build

============================================================
103. FINAL INSTRUCTION
============================================================

DO NOT STOP AT ANALYSIS.

Inspect the existing project first.

Then implement the missing functionality.

Finish incomplete modules.

Connect every required page to the actual database.

Preserve the existing architecture wherever possible.

Build the application page by page.

Do not leave required functionality as placeholders.

Do not fake functionality.

Do not claim something works if it does not.

If an external integration such as:

- IoT temperature sensors
- Camera QR scanning
- Government identity verification
- Payment gateway
- SMS
- WhatsApp
- GPS tracking

is not actually configured, build the application architecture so it can
be integrated later, but clearly do not pretend the integration exists.

The final result must be a real enterprise-grade Kishan Corporation
Fresh Produce Procurement, Inventory, Sales, Fleet, Logistics and
Workforce Management System.

============================================================
END OF MASTER PROMPT
============================================================