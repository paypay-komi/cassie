-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CourtVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "votedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourtVote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourtVote" ("caseId", "id", "updatedAt", "value", "voterId") SELECT "caseId", "id", "updatedAt", "value", "voterId" FROM "CourtVote";
DROP TABLE "CourtVote";
ALTER TABLE "new_CourtVote" RENAME TO "CourtVote";
CREATE INDEX "CourtVote_voterId_idx" ON "CourtVote"("voterId");
CREATE UNIQUE INDEX "CourtVote_caseId_voterId_key" ON "CourtVote"("caseId", "voterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
