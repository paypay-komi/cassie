/*
  Warnings:

  - You are about to drop the column `location` on the `userTimezone` table. All the data in the column will be lost.
  - You are about to drop the column `notifyEnabled` on the `userTimezone` table. All the data in the column will be lost.
  - You are about to drop the column `offset` on the `userTimezone` table. All the data in the column will be lost.
  - You are about to drop the column `timeZone` on the `userTimezone` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_userTimezone" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "minsOffset" INTEGER NOT NULL DEFAULT 0,
    "timeZoneString" TEXT DEFAULT 'NONE',
    "timeFormat" TEXT DEFAULT '12H',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_userTimezone" ("createdAt", "timeFormat", "updatedAt", "userId") SELECT "createdAt", "timeFormat", "updatedAt", "userId" FROM "userTimezone";
DROP TABLE "userTimezone";
ALTER TABLE "new_userTimezone" RENAME TO "userTimezone";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
