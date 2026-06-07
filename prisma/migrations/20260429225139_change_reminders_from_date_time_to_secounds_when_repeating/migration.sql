/*
  Warnings:

  - You are about to drop the column `repeating` on the `reminder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "reminder" DROP COLUMN "repeating";
ALTER TABLE "reminder" ADD COLUMN "repeatingSecs" INTEGER;
