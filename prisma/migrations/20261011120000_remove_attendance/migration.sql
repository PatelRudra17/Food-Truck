-- Remove the Attendance feature.

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_labourId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_shiftId_fkey";

-- DropTable
DROP TABLE "Attendance";

-- DropEnum
DROP TYPE "AttendanceStatus";

-- Remove ATTENDANCE_* permissions (RolePermission rows cascade)
DELETE FROM "Permission" WHERE "code" LIKE 'ATTENDANCE\_%';
