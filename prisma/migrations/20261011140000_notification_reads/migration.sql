-- Per-user read receipts for role-wide notifications.

-- CreateTable
CREATE TABLE "NotificationRead" (
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateIndex
CREATE INDEX "NotificationRead_userId_idx" ON "NotificationRead"("userId");

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Role notifications already marked read under the old shared flag stay read
-- for everyone currently in that role, so nobody suddenly sees old alerts as new.
INSERT INTO "NotificationRead" ("notificationId", "userId")
SELECT n."id", u."id"
FROM "Notification" n
JOIN "User" u ON u."roleId" = n."roleId"
WHERE n."roleId" IS NOT NULL AND n."isRead" = true
ON CONFLICT DO NOTHING;
