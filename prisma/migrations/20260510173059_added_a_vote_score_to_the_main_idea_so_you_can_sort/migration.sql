-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectedBy" TEXT,
    "rejectedAt" DATETIME,
    "rejectReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "spamScore" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vote_score" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Idea" ("approvedAt", "approvedBy", "authorId", "content", "createdAt", "id", "rejectReason", "rejectedAt", "rejectedBy", "spamScore", "status") SELECT "approvedAt", "approvedBy", "authorId", "content", "createdAt", "id", "rejectReason", "rejectedAt", "rejectedBy", "spamScore", "status" FROM "Idea";
DROP TABLE "Idea";
ALTER TABLE "new_Idea" RENAME TO "Idea";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
