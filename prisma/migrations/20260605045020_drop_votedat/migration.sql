/*
  Warnings:

  - You are about to drop the column `votedAt` on the `CourtVote` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `CourtVote` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CourtVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourtVote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CourtVote" ("caseId", "id", "value", "voterId") SELECT "caseId", "id", "value", "voterId" FROM "CourtVote";
DROP TABLE "CourtVote";
ALTER TABLE "new_CourtVote" RENAME TO "CourtVote";
CREATE INDEX "CourtVote_voterId_idx" ON "CourtVote"("voterId");
CREATE UNIQUE INDEX "CourtVote_caseId_voterId_key" ON "CourtVote"("caseId", "voterId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
