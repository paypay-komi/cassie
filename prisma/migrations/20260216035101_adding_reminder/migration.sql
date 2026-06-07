-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "remindAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repeating" TIMESTAMP
);

-- CreateIndex
CREATE INDEX "reminder_userId_idx" ON "reminder"("userId");
