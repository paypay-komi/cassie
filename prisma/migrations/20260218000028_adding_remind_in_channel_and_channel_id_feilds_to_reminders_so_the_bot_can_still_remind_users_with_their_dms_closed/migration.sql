-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repeating" DATETIME,
    "remindInChannel" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT
);
INSERT INTO "new_reminder" ("content", "createdAt", "id", "remindAt", "repeating", "userId") SELECT "content", "createdAt", "id", "remindAt", "repeating", "userId" FROM "reminder";
DROP TABLE "reminder";
ALTER TABLE "new_reminder" RENAME TO "reminder";
CREATE INDEX "reminder_userId_idx" ON "reminder"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
