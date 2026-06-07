/*
  Warnings:

  - You are about to drop the column `location` on the `userTimezone` table. All the data in the column will be lost.
  - You are about to drop the column `notifyEnabled` on the `userTimezone` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "userTimezone" RENAME COLUMN "offset" TO "minsOffset";
ALTER TABLE "userTimezone" ALTER COLUMN "minsOffset" SET NOT NULL;
ALTER TABLE "userTimezone" ALTER COLUMN "minsOffset" SET DEFAULT 0;
ALTER TABLE "userTimezone" RENAME COLUMN "timeZone" TO "timeZoneString";
ALTER TABLE "userTimezone" ALTER COLUMN "timeZoneString" SET DEFAULT 'NONE';
ALTER TABLE "userTimezone" DROP COLUMN "location";
ALTER TABLE "userTimezone" DROP COLUMN "notifyEnabled";
ALTER TABLE "userTimezone" ALTER COLUMN "timeFormat" SET DEFAULT '12H';
