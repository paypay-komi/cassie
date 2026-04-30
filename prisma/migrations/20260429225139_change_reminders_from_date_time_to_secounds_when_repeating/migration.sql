/*
  Warnings:

  - You are about to drop the column `repeating` on the `reminder` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repeatingSecs" INTEGER,
    "remindInChannel" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT
);
INSERT INTO "new_reminder" ("channelId", "content", "createdAt", "id", "remindAt", "remindInChannel", "userId") SELECT "channelId", "content", "createdAt", "id", "remindAt", "remindInChannel", "userId" FROM "reminder";
DROP TABLE "reminder";
ALTER TABLE "new_reminder" RENAME TO "reminder";
CREATE INDEX "reminder_userId_idx" ON "reminder"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
