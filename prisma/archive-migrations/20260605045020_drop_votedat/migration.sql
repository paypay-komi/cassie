/*
  Warnings:

  - You are about to drop the column `votedAt` on the `CourtVote` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `CourtVote` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CourtVote" DROP COLUMN "votedAt";
ALTER TABLE "CourtVote" ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
