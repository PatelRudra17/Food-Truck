-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING_UNLOADING', 'PENDING_SORTING', 'SORTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WastageReason" AS ENUM ('DAMAGED', 'ROTTEN', 'QUALITY_REJECTION', 'HANDLING_DAMAGE', 'EXPIRED', 'OTHER');

-- CreateEnum
CREATE TYPE "WastageStage" AS ENUM ('SORTING', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('RAW', 'GRADE_A', 'GRADE_B', 'GRADE_C', 'OTHER');

-- CreateEnum
CREATE TYPE "GradeLedgerTxnType" AS ENUM ('PROCUREMENT', 'SORTING', 'WASTAGE', 'SALE', 'DISPATCH', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'RETURN', 'DISPOSAL');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'READY_FOR_DISPATCH', 'PARTIALLY_FULFILLED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RouteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('CREATED', 'APPROVED', 'LOADING', 'LOADED', 'DISPATCHED', 'DELIVERED', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrateStatus" AS ENUM ('AVAILABLE', 'LOADED', 'WITH_CUSTOMER', 'RETURNED', 'DAMAGED', 'MISSING', 'CLEANING', 'READY');

-- CreateEnum
CREATE TYPE "CleaningStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('PENDING', 'ASSIGNED', 'COMPLETE', 'REOPENED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CRATE_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'HIGH_WASTAGE';
ALTER TYPE "NotificationType" ADD VALUE 'DISPATCH_PENDING';

-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "salesOrderFk" TEXT,
ADD COLUMN     "wastageFk" TEXT;

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "employeeFk" TEXT,
ADD COLUMN     "procurementFk" TEXT,
ADD COLUMN     "salesOrderFk" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "location" TEXT,
    "gstNumber" TEXT,
    "status" "ActiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procurement" (
    "id" TEXT NOT NULL,
    "procurementNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "gateEntryId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceNumber" TEXT,
    "createdById" TEXT NOT NULL,
    "remarks" TEXT,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementItem" (
    "id" TEXT NOT NULL,
    "procurementId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "weight" DECIMAL(14,3) NOT NULL,
    "quality" TEXT,
    "purchasePrice" DECIMAL(14,2),
    "total" DECIMAL(14,2),

    CONSTRAINT "ProcurementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "procurementId" TEXT NOT NULL,
    "procurementItemId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "gateEntryId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "rawWeight" DECIMAL(14,3) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING_UNLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unloading" (
    "id" TEXT NOT NULL,
    "gateEntryId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "supplierId" TEXT,
    "arrivalAt" TIMESTAMP(3),
    "unloadingStartAt" TIMESTAMP(3),
    "unloadingEndAt" TIMESTAMP(3),
    "weight" DECIMAL(14,3),
    "unloadingStaffId" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unloading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sorting" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rawWeight" DECIMAL(14,3) NOT NULL,
    "gradeAWeight" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "gradeBWeight" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "gradeCWeight" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "otherGradeWeight" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "wasteWeight" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "wasteReason" "WastageReason",
    "sortedById" TEXT NOT NULL,
    "sortedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sorting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wastage" (
    "id" TEXT NOT NULL,
    "wastageNumber" TEXT NOT NULL,
    "stage" "WastageStage" NOT NULL,
    "batchId" TEXT,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "reason" "WastageReason" NOT NULL,
    "disposalMethod" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wastage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemGradeStock" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemGradeStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeLedger" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL,
    "transactionType" "GradeLedgerTxnType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "beforeQty" DECIMAL(14,3) NOT NULL,
    "afterQty" DECIMAL(14,3) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "batchId" TEXT,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "soNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "deliveryDate" TIMESTAMP(3),
    "priority" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'GRADE_A',
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "fulfilledQty" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteCluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouteCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "routeNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startLocation" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "routeClusterId" TEXT,
    "estimatedDistanceKm" DECIMAL(8,2),
    "estimatedTimeMinutes" INTEGER,
    "status" "RouteStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "routeId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "loadingStaffId" TEXT,
    "departureAt" TIMESTAMP(3),
    "expectedArrivalAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "eligibilityOverride" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityOverrideReason" TEXT,
    "remarks" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'CREATED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "salesOrderItemId" TEXT,
    "itemId" TEXT NOT NULL,
    "grade" "Grade" NOT NULL DEFAULT 'GRADE_A',
    "quantity" DECIMAL(14,3) NOT NULL,
    "cratesCount" INTEGER,

    CONSTRAINT "TripItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crate" (
    "id" TEXT NOT NULL,
    "crateCode" TEXT NOT NULL,
    "crateType" TEXT NOT NULL,
    "capacity" TEXT,
    "status" "CrateStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLocation" TEXT,
    "customerId" TEXT,
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrateReturn" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "cratesDispatched" INTEGER NOT NULL,
    "cratesReturned" INTEGER NOT NULL DEFAULT 0,
    "cratesDamaged" INTEGER NOT NULL DEFAULT 0,
    "cratesMissing" INTEGER NOT NULL DEFAULT 0,
    "returnDate" TIMESTAMP(3),
    "condition" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrateReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cleaning" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "vehicleId" TEXT,
    "crateId" TEXT,
    "locationText" TEXT,
    "cleaningType" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "staffId" TEXT,
    "status" "CleaningStatus" NOT NULL DEFAULT 'PENDING',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cleaning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "shiftName" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "supervisorId" TEXT,
    "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "previousSupervisorId" TEXT,
    "newSupervisorId" TEXT,
    "handoverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stockIssuesNote" TEXT,
    "cleaningStatusNote" TEXT,
    "crateStatusNote" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextDayPreparation" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NextDayPreparation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextDayChecklistItem" (
    "id" TEXT NOT NULL,
    "preparationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "remark" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextDayChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "department" TEXT,
    "roleTitle" TEXT,
    "joiningDate" TIMESTAMP(3),
    "shiftId" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Labour" (
    "id" TEXT NOT NULL,
    "labourCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "workType" TEXT,
    "dailyWage" DECIMAL(10,2) NOT NULL,
    "shiftId" TEXT,
    "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Labour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "labourId" TEXT,
    "shiftId" TEXT,
    "status" "AttendanceStatus" NOT NULL,
    "overtimeHours" DECIMAL(5,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salary" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT,
    "labourId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "earnings" DECIMAL(12,2) NOT NULL,
    "overtimeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "advances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netSalary" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Salary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");

-- CreateIndex
CREATE INDEX "Customer_status_idx" ON "Customer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Procurement_procurementNumber_key" ON "Procurement"("procurementNumber");

-- CreateIndex
CREATE INDEX "Procurement_status_idx" ON "Procurement"("status");

-- CreateIndex
CREATE INDEX "Procurement_date_idx" ON "Procurement"("date");

-- CreateIndex
CREATE INDEX "ProcurementItem_procurementId_idx" ON "ProcurementItem"("procurementId");

-- CreateIndex
CREATE INDEX "ProcurementItem_itemId_idx" ON "ProcurementItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementBatch_batchNumber_key" ON "ProcurementBatch"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementBatch_procurementItemId_key" ON "ProcurementBatch"("procurementItemId");

-- CreateIndex
CREATE INDEX "ProcurementBatch_status_idx" ON "ProcurementBatch"("status");

-- CreateIndex
CREATE INDEX "ProcurementBatch_itemId_idx" ON "ProcurementBatch"("itemId");

-- CreateIndex
CREATE INDEX "ProcurementBatch_supplierId_idx" ON "ProcurementBatch"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Unloading_gateEntryId_key" ON "Unloading"("gateEntryId");

-- CreateIndex
CREATE INDEX "Unloading_vehicleId_idx" ON "Unloading"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "Sorting_batchId_key" ON "Sorting"("batchId");

-- CreateIndex
CREATE INDEX "Sorting_batchId_idx" ON "Sorting"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Wastage_wastageNumber_key" ON "Wastage"("wastageNumber");

-- CreateIndex
CREATE INDEX "Wastage_stage_idx" ON "Wastage"("stage");

-- CreateIndex
CREATE INDEX "Wastage_itemId_idx" ON "Wastage"("itemId");

-- CreateIndex
CREATE INDEX "Wastage_date_idx" ON "Wastage"("date");

-- CreateIndex
CREATE INDEX "ItemGradeStock_itemId_idx" ON "ItemGradeStock"("itemId");

-- CreateIndex
CREATE INDEX "ItemGradeStock_warehouseId_idx" ON "ItemGradeStock"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemGradeStock_itemId_warehouseId_grade_key" ON "ItemGradeStock"("itemId", "warehouseId", "grade");

-- CreateIndex
CREATE INDEX "GradeLedger_itemId_idx" ON "GradeLedger"("itemId");

-- CreateIndex
CREATE INDEX "GradeLedger_warehouseId_idx" ON "GradeLedger"("warehouseId");

-- CreateIndex
CREATE INDEX "GradeLedger_referenceType_referenceId_idx" ON "GradeLedger"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "GradeLedger_createdAt_idx" ON "GradeLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_soNumber_key" ON "SalesOrder"("soNumber");

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "SalesOrder"("status");

-- CreateIndex
CREATE INDEX "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_salesOrderId_idx" ON "SalesOrderItem"("salesOrderId");

-- CreateIndex
CREATE INDEX "SalesOrderItem_itemId_idx" ON "SalesOrderItem"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RouteCluster_name_key" ON "RouteCluster"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Route_routeNumber_key" ON "Route"("routeNumber");

-- CreateIndex
CREATE INDEX "Route_status_idx" ON "Route"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_tripNumber_key" ON "Trip"("tripNumber");

-- CreateIndex
CREATE INDEX "Trip_status_idx" ON "Trip"("status");

-- CreateIndex
CREATE INDEX "Trip_vehicleId_idx" ON "Trip"("vehicleId");

-- CreateIndex
CREATE INDEX "Trip_driverId_idx" ON "Trip"("driverId");

-- CreateIndex
CREATE INDEX "TripItem_tripId_idx" ON "TripItem"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Crate_crateCode_key" ON "Crate"("crateCode");

-- CreateIndex
CREATE INDEX "Crate_status_idx" ON "Crate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CrateReturn_returnNumber_key" ON "CrateReturn"("returnNumber");

-- CreateIndex
CREATE INDEX "CrateReturn_tripId_idx" ON "CrateReturn"("tripId");

-- CreateIndex
CREATE INDEX "CrateReturn_customerId_idx" ON "CrateReturn"("customerId");

-- CreateIndex
CREATE INDEX "Cleaning_status_idx" ON "Cleaning"("status");

-- CreateIndex
CREATE INDEX "Shift_status_idx" ON "Shift"("status");

-- CreateIndex
CREATE INDEX "Shift_date_idx" ON "Shift"("date");

-- CreateIndex
CREATE INDEX "ShiftHandover_shiftId_idx" ON "ShiftHandover"("shiftId");

-- CreateIndex
CREATE UNIQUE INDEX "NextDayPreparation_date_key" ON "NextDayPreparation"("date");

-- CreateIndex
CREATE INDEX "NextDayChecklistItem_preparationId_idx" ON "NextDayChecklistItem"("preparationId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Labour_labourCode_key" ON "Labour"("labourCode");

-- CreateIndex
CREATE INDEX "Labour_status_idx" ON "Labour"("status");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_date_employeeId_key" ON "Attendance"("date", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_date_labourId_key" ON "Attendance"("date", "labourId");

-- CreateIndex
CREATE INDEX "Salary_employeeId_idx" ON "Salary"("employeeId");

-- CreateIndex
CREATE INDEX "Salary_labourId_idx" ON "Salary"("labourId");

-- CreateIndex
CREATE INDEX "Salary_paymentStatus_idx" ON "Salary"("paymentStatus");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_procurementFk_fkey" FOREIGN KEY ("procurementFk") REFERENCES "Procurement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_salesOrderFk_fkey" FOREIGN KEY ("salesOrderFk") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_employeeFk_fkey" FOREIGN KEY ("employeeFk") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_salesOrderFk_fkey" FOREIGN KEY ("salesOrderFk") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_wastageFk_fkey" FOREIGN KEY ("wastageFk") REFERENCES "Wastage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_gateEntryId_fkey" FOREIGN KEY ("gateEntryId") REFERENCES "VehicleGateEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procurement" ADD CONSTRAINT "Procurement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "Procurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_procurementId_fkey" FOREIGN KEY ("procurementId") REFERENCES "Procurement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_procurementItemId_fkey" FOREIGN KEY ("procurementItemId") REFERENCES "ProcurementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_gateEntryId_fkey" FOREIGN KEY ("gateEntryId") REFERENCES "VehicleGateEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementBatch" ADD CONSTRAINT "ProcurementBatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unloading" ADD CONSTRAINT "Unloading_gateEntryId_fkey" FOREIGN KEY ("gateEntryId") REFERENCES "VehicleGateEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unloading" ADD CONSTRAINT "Unloading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unloading" ADD CONSTRAINT "Unloading_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unloading" ADD CONSTRAINT "Unloading_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unloading" ADD CONSTRAINT "Unloading_unloadingStaffId_fkey" FOREIGN KEY ("unloadingStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sorting" ADD CONSTRAINT "Sorting_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProcurementBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sorting" ADD CONSTRAINT "Sorting_sortedById_fkey" FOREIGN KEY ("sortedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProcurementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wastage" ADD CONSTRAINT "Wastage_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGradeStock" ADD CONSTRAINT "ItemGradeStock_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemGradeStock" ADD CONSTRAINT "ItemGradeStock_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeLedger" ADD CONSTRAINT "GradeLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeLedger" ADD CONSTRAINT "GradeLedger_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeLedger" ADD CONSTRAINT "GradeLedger_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProcurementBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeLedger" ADD CONSTRAINT "GradeLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_routeClusterId_fkey" FOREIGN KEY ("routeClusterId") REFERENCES "RouteCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_loadingStaffId_fkey" FOREIGN KEY ("loadingStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_salesOrderItemId_fkey" FOREIGN KEY ("salesOrderItemId") REFERENCES "SalesOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crate" ADD CONSTRAINT "Crate_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrateReturn" ADD CONSTRAINT "CrateReturn_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrateReturn" ADD CONSTRAINT "CrateReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrateReturn" ADD CONSTRAINT "CrateReturn_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrateReturn" ADD CONSTRAINT "CrateReturn_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cleaning" ADD CONSTRAINT "Cleaning_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cleaning" ADD CONSTRAINT "Cleaning_crateId_fkey" FOREIGN KEY ("crateId") REFERENCES "Crate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cleaning" ADD CONSTRAINT "Cleaning_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_previousSupervisorId_fkey" FOREIGN KEY ("previousSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_newSupervisorId_fkey" FOREIGN KEY ("newSupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextDayPreparation" ADD CONSTRAINT "NextDayPreparation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextDayChecklistItem" ADD CONSTRAINT "NextDayChecklistItem_preparationId_fkey" FOREIGN KEY ("preparationId") REFERENCES "NextDayPreparation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextDayChecklistItem" ADD CONSTRAINT "NextDayChecklistItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Labour" ADD CONSTRAINT "Labour_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salary" ADD CONSTRAINT "Salary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salary" ADD CONSTRAINT "Salary_labourId_fkey" FOREIGN KEY ("labourId") REFERENCES "Labour"("id") ON DELETE SET NULL ON UPDATE CASCADE;
