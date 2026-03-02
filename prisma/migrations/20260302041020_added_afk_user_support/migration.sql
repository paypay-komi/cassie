-- CreateTable
CREATE TABLE "AfkUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "since" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "AfkMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "afkUserId" TEXT NOT NULL,
    "mentionedBy" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AfkMention_afkUserId_fkey" FOREIGN KEY ("afkUserId") REFERENCES "AfkUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AfkUser_userId_idx" ON "AfkUser"("userId");

-- CreateIndex
CREATE INDEX "AfkUser_guildId_idx" ON "AfkUser"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "AfkUser_guildId_userId_key" ON "AfkUser"("guildId", "userId");

-- CreateIndex
CREATE INDEX "AfkMention_afkUserId_idx" ON "AfkMention"("afkUserId");
