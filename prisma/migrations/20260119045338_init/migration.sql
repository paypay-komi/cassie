-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT DEFAULT 'c.',
    "disabledCommands" JSONB NOT NULL DEFAULT []
);

-- CreateTable
CREATE TABLE "ChannelSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "disabledCommands" JSONB NOT NULL DEFAULT [],
    "guildId" TEXT NOT NULL,
    CONSTRAINT "ChannelSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildUserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disabledCommands" JSONB NOT NULL DEFAULT [],
    "customPrefix" TEXT,
    "statTracking" BOOLEAN NOT NULL DEFAULT true,
    "commandStatsId" TEXT,
    CONSTRAINT "GuildUserSettings_commandStatsId_fkey" FOREIGN KEY ("commandStatsId") REFERENCES "CommandStats" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GuildUserSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commandStatsId" TEXT,
    CONSTRAINT "UserCommandStats_commandStatsId_fkey" FOREIGN KEY ("commandStatsId") REFERENCES "CommandStats" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalCommandStats" (
    "commandName" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildUserSettings_guildId_userId_key" ON "GuildUserSettings"("guildId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCommandStats_userId_guildId_commandName_key" ON "UserCommandStats"("userId", "guildId", "commandName");
