-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repeating" DATETIME
);

-- CreateIndex
CREATE INDEX "reminder_userId_idx" ON "reminder"("userId");
