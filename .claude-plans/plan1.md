You are a senior product architect, UX designer, full-stack engineer, database architect, security engineer, QA engineer, and DevOps engineer.

Build a COMPLETE PRODUCTION-READY COMPANY INVENTORY, STOCK, VEHICLE, DRIVER AND LOGISTICS MANAGEMENT WEB APPLICATION.

IMPORTANT:
This must NOT be a static UI demo.
This must NOT be a frontend-only prototype.
This must be a REAL WORKING FULL-STACK APPLICATION with authentication, database, APIs/server actions, validation, transactions, file storage, permissions, reports, audit logs, notifications and production-ready architecture.

The application should feel like a professional enterprise ERP/inventory management product.

==================================================
1. CORE PRODUCT
==================================================

Application name:
Enterprise Inventory & Logistics Management System

Primary modules:

1. Dashboard
2. Item Master
3. Categories
4. Warehouses / Locations
5. Stock Inward
6. Stock Outward
7. Stock Transfer
8. Stock Adjustment
9. Inventory Ledger
10. Purchase Orders
11. Suppliers
12. Vehicle Management
13. Driver Management
14. Vehicle Gate Inward
15. Vehicle Gate Outward
16. Driver Documents
17. Vehicle Documents
18. Reports
19. Notifications
20. User Management
21. Roles & Permissions
22. Approval Workflow
23. Audit Logs
24. Document Management
25. Global Search
26. System Settings
27. Profile / Account Settings

==================================================
2. TECHNOLOGY
==================================================

Use a modern production-ready architecture.

Preferred stack:

Frontend:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Responsive design
- Accessible components

Backend:
- Next.js server-side APIs/server actions or a clean backend architecture
- Strong server-side validation
- Secure authentication
- Role-based authorization

Database:
- PostgreSQL
- Prisma ORM

Storage:
- Private S3-compatible object storage for documents

Authentication:
- Secure session-based authentication
- Password hashing
- Role-based access control
- Session expiration
- Logout
- Optional MFA-ready architecture

Validation:
- Zod or equivalent schema validation

Forms:
- React Hook Form or equivalent

Charts:
- Use a reliable chart library

Reports:
- Excel export
- CSV export
- PDF generation
- Print-friendly reports

Deployment:
- Docker-ready
- Environment-variable configuration
- Production build must work without mock data

Do not hardcode secrets.

==================================================
3. DESIGN SYSTEM / UI UX
==================================================

Create a premium enterprise SaaS interface.

Design should be:

- Modern
- Professional
- Clean
- High information density but not cluttered
- Responsive
- Accessible
- Fast
- Consistent

Desktop:
- Left sidebar navigation
- Top header
- Breadcrumbs
- Global search
- Notification center
- User profile menu

Mobile:
- Responsive navigation
- Bottom navigation or mobile drawer
- Touch-friendly controls
- Responsive tables
- Mobile-friendly forms

Use:
- Cards
- Data tables
- Tabs
- Drawers
- Modals
- Confirmation dialogs
- Toast notifications
- Status badges
- Skeleton loaders
- Empty states
- Error states
- Loading states

Do not overuse glassmorphism or decorative 3D effects.
The application must look like a serious company ERP product.

Use consistent spacing, typography, icons, buttons and status colors.

==================================================
4. DASHBOARD
==================================================

Create an advanced dashboard.

KPI cards:

- Total Items
- Total Stock
- Available Stock
- Today's Inward
- Today's Outward
- Low Stock
- Out of Stock
- Total Vehicles
- Vehicles Inside
- Vehicles Outside
- Active Drivers
- Expiring Documents
- Pending Approvals

Charts:

- Inward vs Outward
- Monthly stock movement
- Category-wise stock
- Warehouse-wise stock
- Top consumed items
- Low-stock trend

Tables:

- Recent transactions
- Pending approvals
- Low-stock items
- Expiring vehicle documents
- Expiring driver documents

All dashboard data must come from the real database.

Cards and charts must be clickable.

==================================================
5. ITEM MASTER
==================================================

Create complete item management.

Fields:

- ID
- SKU
- Item Code
- Item Name
- Category
- Subcategory
- Brand
- Description
- Unit
- Minimum Stock
- Maximum Stock
- Reorder Level
- Opening Stock
- Current Stock
- Warehouse
- Rack
- Shelf
- Bin
- Supplier
- Purchase Price
- Tax/GST if applicable
- HSN/SAC if applicable
- Barcode
- QR Code
- Batch Number if applicable
- Serial Number if applicable
- Expiry Date if applicable
- Item Image
- Attachments
- Active/Inactive

Features:

- Create
- View
- Edit
- Archive
- Search
- Filter
- Sort
- Pagination
- Bulk import
- Excel export
- QR generation
- Barcode generation

Never directly edit current stock through the item master.

==================================================
6. INVENTORY ENGINE
==================================================

Implement a reliable transaction-based stock engine.

Stock calculation:

Available Stock =
Opening Stock
+ Inward
+ Transfer In
+ Positive Adjustments
- Outward
- Transfer Out
- Negative Adjustments
- Damaged/Disposed Stock

All stock changes must happen through database transactions.

Never allow negative stock unless an administrator explicitly enables this in settings.

Use database transactions/locking where necessary to prevent race conditions.

Every stock change must create an inventory ledger record.

Inventory ledger must record:

- Transaction ID
- Item
- Warehouse
- Transaction type
- Quantity
- Before quantity
- After quantity
- Reference number
- User
- Timestamp
- Reason

==================================================
7. STOCK INWARD
==================================================

Create professional inward workflow.

Fields:

- Inward Number
- Date
- Supplier
- Purchase Order
- Invoice Number
- Vehicle
- Driver
- Warehouse
- Received By
- Remarks
- Attachments

Items table:

- Item
- Quantity
- Unit
- Batch
- Serial
- Expiry
- Rate
- Tax
- Total

Support multiple items per inward.

Automatically update stock after successful completion.

Statuses:

Draft
Pending
Approved
Received
Cancelled

Generate printable inward receipt.

==================================================
8. STOCK OUTWARD
==================================================

Fields:

- Outward Number
- Date
- Department
- Project/Site
- Requested By
- Approved By
- Warehouse
- Vehicle
- Driver
- Destination
- Receiver
- Purpose
- Remarks
- Attachments

Items:

- Item
- Available Quantity
- Requested Quantity
- Unit
- Batch
- Serial

Before submission, validate stock availability.

Do not permit quantity greater than available stock.

Workflow:

Draft
Pending Approval
Approved
Issued
Rejected
Cancelled

Update inventory only at the correct business stage.

Generate printable outward receipt.

==================================================
9. STOCK TRANSFER
==================================================

Create:

- Transfer Number
- Source Warehouse
- Destination Warehouse
- Items
- Quantity
- Requested By
- Approved By
- Dispatch Date
- Received Date
- Remarks

Statuses:

Draft
Requested
Approved
Dispatched
Received
Rejected
Cancelled

Update stock safely.

==================================================
10. STOCK ADJUSTMENT
==================================================

Allow authorized users to make adjustments.

Fields:

- Item
- Warehouse
- Current Quantity
- Physical Quantity
- Difference
- Reason
- Attachment
- Created By
- Approved By

Examples:

- Physical count mismatch
- Damaged stock
- Lost stock
- Found stock
- Data correction

Never silently overwrite stock.

Every adjustment must be recorded in the audit trail.

==================================================
11. WAREHOUSE MANAGEMENT
==================================================

Support multiple locations.

Warehouse fields:

- Warehouse ID
- Name
- Code
- Address
- Manager
- Contact
- Status

Support:

Warehouse
→ Rack
→ Shelf
→ Bin

Allow warehouse-wise inventory reports.

==================================================
12. PURCHASE ORDERS
==================================================

Create purchase order module.

Fields:

- PO Number
- Supplier
- Date
- Expected Delivery
- Items
- Quantity
- Rate
- Tax
- Total
- Created By
- Approved By
- Remarks

Statuses:

Draft
Pending Approval
Approved
Partially Received
Received
Cancelled

PO should connect with Stock Inward.

==================================================
13. SUPPLIER MANAGEMENT
==================================================

Fields:

- Supplier ID
- Company Name
- Contact Person
- Phone
- Email
- Address
- GST information if applicable
- PAN information only when legitimately required
- Documents
- Status

Show:

- Purchase history
- Items supplied
- Inward history

==================================================
14. VEHICLE MANAGEMENT
==================================================

Vehicle fields:

- Vehicle ID
- Vehicle Number
- Vehicle Type
- Manufacturer
- Model
- Owner/Company
- Registration Date
- Registration Expiry
- Insurance Expiry
- PUC Expiry
- Fitness Expiry
- Permit Expiry
- Capacity
- Current Driver
- Current Location
- Status
- Vehicle Image
- Documents

Vehicle status:

Available
Inside
Outside
On Trip
Maintenance
Inactive

==================================================
15. DRIVER MANAGEMENT
==================================================

Create complete driver profiles.

Basic fields:

- Driver ID
- Employee ID
- Full Name
- Mobile
- Alternate Mobile
- Address
- Date of Birth
- Joining Date
- Emergency Contact
- Profile Photo
- Status

Do not collect unnecessary personal information.

==================================================
16. DRIVER IDENTITY DOCUMENTS
==================================================

Provide a secure Driver Documents section.

Supported document types:

1. Aadhaar
2. PAN
3. Driving Licence
4. Address Proof
5. Fitness/Medical document if required
6. Police Verification if required
7. Training Certificate
8. Other documents

Aadhaar fields:

- Aadhaar Number
- Aadhaar Document
- Verification Status

PAN:

- PAN Number
- PAN Document
- Verification Status

Driving Licence:

- Licence Number
- Licence Class
- Issue Date
- Expiry Date
- Issuing Authority
- Licence Document
- Verification Status

IMPORTANT SECURITY REQUIREMENTS:

Aadhaar and PAN are highly sensitive identity information.

Do NOT display full Aadhaar/PAN values throughout the UI.

Use masked display such as:

Aadhaar:
XXXX XXXX 4821

PAN:
XXXXX4821X

Sensitive information must have:

- Encryption at rest
- Secure database storage
- Private document storage
- Strict role-based permissions
- Server-side authorization
- Masked UI
- Access logging
- Download logging
- No sensitive information in application logs
- No sensitive information in URLs
- No public document URLs
- Secure temporary/signed document access
- Retention/deletion controls
- Ability to disable collection where not required

Only authorized roles can view sensitive documents.

Create a separate permission:

VIEW_SENSITIVE_DRIVER_DOCUMENTS

==================================================
17. DOCUMENT EXPIRY MANAGEMENT
==================================================

Track expiry dates for:

- Driving Licence
- Vehicle Insurance
- PUC
- Registration
- Fitness
- Permit
- Other configured documents

Dashboard should show:

Expired
Expires in 7 days
Expires in 15 days
Expires in 30 days
Expires in 60 days

Create notifications automatically.

==================================================
18. VEHICLE GATE ENTRY
==================================================

Vehicle In:

- Gate Entry Number
- Vehicle
- Driver
- Supplier
- Purpose
- Material
- Time In
- Security Staff
- Remarks

Vehicle Out:

- Gate Exit Number
- Vehicle
- Driver
- Time Out
- Destination
- Material
- Receiver
- Remarks

Calculate:

- Total time inside premises

Show:

Vehicles currently inside
Vehicles currently outside

==================================================
19. REPORTING
==================================================

Create report center.

Reports:

- Current Stock
- Stock Ledger
- Inward
- Outward
- Transfer
- Adjustment
- Warehouse Stock
- Item-wise
- Category-wise
- Supplier-wise
- Date-wise
- Low Stock
- Out of Stock
- Damaged Stock
- Expired Stock
- Vehicle Entry/Exit
- Driver List
- Vehicle List
- Driver Document Expiry
- Vehicle Document Expiry
- Purchase Order
- Audit Log

Every report should support filters.

Export:

- Excel
- CSV
- PDF
- Print

==================================================
20. SEARCH
==================================================

Create global search.

Search across:

- Items
- SKU
- Barcode
- QR
- Inward
- Outward
- Transfer
- PO
- Vehicle
- Driver
- Supplier

Show grouped search results.

==================================================
21. BARCODE / QR
==================================================

Each item can have:

- Barcode
- QR Code

Scanning should open item details.

QR should show:

- Item
- Code
- Current stock
- Warehouse
- Recent movement

Do not expose sensitive information through QR codes.

==================================================
22. USERS / ROLES / PERMISSIONS
==================================================

Roles:

Super Admin
Store Manager
Store Operator
Vehicle Manager
Gate Operator
Auditor
Management

Permissions:

VIEW
CREATE
EDIT
DELETE/ARCHIVE
APPROVE
EXPORT
PRINT
DOWNLOAD_DOCUMENT
VIEW_SENSITIVE_DOCUMENT
MANAGE_USERS
MANAGE_SETTINGS

Permissions must be checked server-side.

Never rely only on hiding frontend buttons.

==================================================
23. APPROVAL WORKFLOW
==================================================

Implement approval workflows for:

- Stock Outward
- Stock Adjustment
- Purchase Order
- Stock Transfer
- Other configurable transactions

Approval history:

- Requested By
- Requested At
- Approved/Rejected By
- Date
- Comment

==================================================
24. NOTIFICATION SYSTEM
==================================================

Create notification center.

Notifications:

- Low stock
- Out of stock
- Document expiring
- Document expired
- Pending approval
- Stock transfer pending
- Purchase order pending
- Important system alerts

Support read/unread state.

==================================================
25. AUDIT LOG
==================================================

Create immutable audit logging.

Track:

- Login
- Logout
- Create
- Edit
- Archive
- Approval
- Rejection
- Stock adjustment
- Document access
- Document download
- Sensitive document access
- Export
- Permission change
- User creation
- User deactivation
- Settings changes

Audit record:

- User
- Action
- Entity
- Entity ID
- Old values where appropriate
- New values where appropriate
- Timestamp
- Request/device metadata where appropriate

Never expose audit-log deletion to normal users.

==================================================
26. DOCUMENT MANAGEMENT
==================================================

Private document storage.

Support:

PDF
JPG
PNG
XLSX where appropriate

Features:

- Upload
- Preview
- Download
- Delete according to permission
- Document version
- Document type
- Upload date
- Uploaded by
- Expiry date
- Access history

Validate file type and size.

Never store sensitive documents in a public folder.

==================================================
27. DATABASE DESIGN
==================================================

Create normalized PostgreSQL schema.

Expected entities include:

User
Role
Permission
RolePermission
Category
Item
Warehouse
Location
Supplier
PurchaseOrder
PurchaseOrderItem
StockInward
StockInwardItem
StockOutward
StockOutwardItem
StockTransfer
StockTransferItem
StockAdjustment
InventoryLedger
Vehicle
VehicleDocument
Driver
DriverDocument
VehicleGateEntry
VehicleGateExit
Notification
AuditLog
Attachment
Approval
SystemSetting

Use:

- Primary keys
- Foreign keys
- Unique constraints
- Indexes
- Timestamps
- Soft delete/archive where appropriate
- Referential integrity

Add database indexes for frequently searched fields.

==================================================
28. DATA INTEGRITY
==================================================

Inventory operations must be atomic.

For example:

When completing Stock Outward:

1. Validate user permission.
2. Validate transaction status.
3. Lock/check inventory.
4. Verify available quantity.
5. Create outward transaction.
6. Create ledger records.
7. Update inventory state if using materialized stock.
8. Create audit record.
9. Commit transaction.

If any step fails, rollback everything.

Never leave partially updated inventory.

==================================================
29. SECURITY
==================================================

Implement:

- HTTPS-ready architecture
- Password hashing
- Secure sessions
- CSRF protection where applicable
- Input validation
- Output encoding
- SQL injection protection through ORM
- XSS protection
- Rate limiting
- Secure headers
- Server-side authorization
- File upload validation
- Private document storage
- Secure error handling
- No secrets in source code
- Environment variables
- Database backup strategy
- Audit logging

Never return sensitive data unnecessarily through APIs.

==================================================
30. ERROR HANDLING
==================================================

Every page needs:

Loading state
Empty state
Error state
Success state

Show useful user-friendly messages.

Do not expose database stack traces to users.

==================================================
31. SEED DATA
==================================================

Create realistic demo seed data:

- 20+ items
- Multiple categories
- 3+ warehouses
- Multiple suppliers
- 10+ drivers
- 10+ vehicles
- Driver documents
- Vehicle documents
- Inward transactions
- Outward transactions
- Transfers
- Purchase orders
- Notifications
- Users with different roles

Clearly separate demo/seed data from production data.

==================================================
32. IMPORT / EXPORT
==================================================

Allow authorized users to import:

- Items
- Suppliers
- Drivers
- Vehicles

Use Excel/CSV templates.

Validate every row before importing.

Show:

Successful rows
Failed rows
Validation errors

Do not partially corrupt the database.

==================================================
33. SETTINGS
==================================================

System settings:

- Company name
- Company logo
- Address
- Contact
- Currency
- Date format
- Time zone
- Stock rules
- Negative stock policy
- Numbering format
- Notification settings
- Document expiry rules
- User roles
- Warehouse settings

==================================================
34. PERFORMANCE
==================================================

Do not load thousands of records into the browser at once.

Use:

- Server-side pagination
- Filtering
- Sorting
- Database indexes
- Lazy loading
- Efficient queries
- Caching where appropriate

Tables must remain usable with large datasets.

==================================================
35. RESPONSIVE REQUIREMENT
==================================================

The complete system must work properly on:

- Desktop
- Laptop
- Tablet
- Mobile

No horizontal overflow on normal mobile screens.

Forms must be mobile-friendly.

==================================================
36. ACCESSIBILITY
==================================================

Use:

- Semantic HTML
- Keyboard navigation
- Labels
- Accessible dialogs
- Focus management
- Proper contrast
- ARIA only when required

==================================================
37. TESTING
==================================================

Create:

- Unit tests
- API/server tests
- Inventory calculation tests
- Permission tests
- Authentication tests
- Stock race-condition tests where practical
- File upload validation tests
- End-to-end tests for critical workflows

Critical test cases:

1. Inward increases stock.
2. Outward decreases stock.
3. Outward cannot exceed available stock.
4. Transfer moves stock correctly.
5. Adjustment creates ledger entry.
6. Approval permissions work.
7. Unauthorized users cannot access restricted pages.
8. Sensitive driver documents cannot be accessed by unauthorized users.
9. Audit records are generated.
10. Reports match database transactions.

==================================================
38. UX DETAILS
==================================================

Add confirmation dialogs before:

- Approve
- Reject
- Archive
- Cancel
- Stock adjustment
- Document deletion

Use toast messages after successful operations.

Use skeleton loaders for tables and dashboard.

Use clear status badges.

Use empty-state actions such as:

"No items found.
Add your first item."

==================================================
39. NO FAKE FUNCTIONALITY
==================================================

This is extremely important.

Do NOT create buttons that only show:

"Coming soon"

Do NOT create fake charts with hardcoded numbers.

Do NOT create fake authentication.

Do NOT create fake CRUD.

Do NOT use localStorage as the primary database.

Do NOT hardcode inventory totals.

All important functionality must connect to the real database.

If a feature cannot be implemented completely, structure it properly and clearly identify the limitation instead of pretending it works.

==================================================
40. DEMO CREDENTIALS
==================================================

Create development seed users for testing:

Super Admin
Store Manager
Store Operator
Vehicle Manager
Gate Operator
Auditor
Management

Use safe development-only passwords and clearly mark them as development credentials.

Never use real passwords or real identity documents.

==================================================
41. DEPLOYMENT
==================================================

Provide:

- .env.example
- Database migration
- Seed command
- Production build
- Docker configuration
- README
- Setup instructions
- Database backup recommendations
- Storage configuration
- Production environment configuration

Application should be deployable to a modern cloud/VPS environment.

==================================================
42. FINAL ACCEPTANCE CRITERIA
==================================================

The finished application must allow a company to:

1. Login securely.
2. Create users and assign roles.
3. Create warehouses.
4. Create categories.
5. Create items.
6. Add suppliers.
7. Create purchase orders.
8. Receive material through Stock Inward.
9. Automatically increase stock.
10. Issue material through Stock Outward.
11. Automatically decrease stock.
12. Prevent invalid stock issuance.
13. Transfer stock between warehouses.
14. Perform controlled stock adjustments.
15. Maintain complete inventory ledger.
16. Register vehicles.
17. Register drivers.
18. Store driver documents securely.
19. Store Aadhaar/PAN/licence information securely where legitimately required.
20. Mask sensitive identity numbers.
21. Track document expiry.
22. Register vehicle gate entry.
23. Register vehicle gate exit.
24. Track vehicles currently inside.
25. Generate reports.
26. Export Excel/PDF/CSV.
27. Search globally.
28. Generate QR/barcodes.
29. Approve/reject transactions.
30. Receive notifications.
31. View audit logs.
32. Work on desktop and mobile.
33. Handle large datasets.
34. Protect sensitive information.
35. Maintain transaction consistency.
36. Be suitable as a real company software foundation.

==================================================
43. DEVELOPMENT APPROACH
==================================================

Do not build everything as one giant unstructured component.

Use:

- Modular architecture
- Reusable components
- Reusable form components
- Reusable data table
- Reusable modal/dialog
- Reusable status badge
- Reusable permission checks
- Service layer
- Validation schemas
- Database repository/service patterns where appropriate

Keep business logic out of presentation components.

First create the database schema and architecture.

Then authentication and authorization.

Then inventory engine.

Then core modules.

Then vehicle/driver modules.

Then reports.

Then notifications/audit.

Then testing.

Finally perform a complete production-readiness review.

At every stage ensure that existing functionality continues to work.

==================================================
44. IMPORTANT PRODUCT PRINCIPLE
==================================================

This system is an INVENTORY + LOGISTICS MANAGEMENT PLATFORM, not merely a dashboard.

The source of truth is the database and transaction ledger.

Every stock movement must be traceable.

Every sensitive document must be protected.

Every important action must be auditable.

Every role must see only what it is authorized to see.

The final UI should look like software that a real medium/large company could operate daily.