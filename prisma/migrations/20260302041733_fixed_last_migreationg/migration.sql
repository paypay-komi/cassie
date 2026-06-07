/*
  Warnings:

  - You are about to drop the `AfkMention` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AfkUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE IF EXISTS "AfkMention";

-- DropTable
DROP TABLE IF EXISTS "AfkUser";

-- CreateTable
CREATE TABLE "GlobalAfkUser" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "since" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoReply" BOOLEAN NOT NULL DEFAULT true,
    "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPing" BOOLEAN NOT NULL DEFAULT true,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "GlobalAfkMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mentionedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GlobalAfkMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GlobalAfkUser" ("userId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GlobalAfkMention_userId_idx" ON "GlobalAfkMention"("userId");
