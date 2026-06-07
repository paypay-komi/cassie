-- CreateTable
CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "defendantId" TEXT NOT NULL,
    "prosecutorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "threadId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VOTING',
    "voteDeadline" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    "closedAt" TIMESTAMP
);

-- CreateTable
CREATE TABLE "CourtVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "votedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourtVote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_messageId_key" ON "CourtCase"("messageId");

-- CreateIndex
CREATE INDEX "CourtVote_voterId_idx" ON "CourtVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtVote_caseId_voterId_key" ON "CourtVote"("caseId", "voterId");
