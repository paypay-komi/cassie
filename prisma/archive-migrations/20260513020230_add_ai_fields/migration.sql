/*
  Warnings:

  - You are about to drop the column `spamScore` on the `Idea` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Idea" DROP COLUMN "spamScore";
ALTER TABLE "Idea" ADD COLUMN "aiResult" TEXT;
ALTER TABLE "Idea" ADD COLUMN "aiReason" TEXT;
ALTER TABLE "Idea" ADD COLUMN "aiThoughts" TEXT;
ALTER TABLE "Idea" ADD COLUMN "aiConfidence" DOUBLE PRECISION;
ALTER TABLE "Idea" ADD COLUMN "aiCategory" TEXT;
ALTER TABLE "Idea" ADD COLUMN "aiImprovedIdea" TEXT;
ALTER TABLE "Idea" ADD COLUMN "aiDuplicateOf" TEXT;
