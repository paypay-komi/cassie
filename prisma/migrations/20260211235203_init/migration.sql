-- CreateTable
CREATE TABLE "UserGlobalCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GuildSettingsObject" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'guild_settings',
    "data" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "UserDataObject" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'user_data',
    "data" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "todolist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT DEFAULT 'c.',
    "disabledCommands" JSONB NOT NULL,
    "roleDisabledCommands" JSONB NOT NULL,
    "userDisabledCommands" JSONB NOT NULL
);

-- CreateTable
CREATE TABLE "ChannelSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "disabledCommands" JSONB NOT NULL,
    "guildId" TEXT NOT NULL,
    CONSTRAINT "ChannelSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuildUserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disabledCommands" JSONB NOT NULL,
    "customPrefix" TEXT,
    "statTracking" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GuildUserSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GlobalStats" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global'
);

-- CreateTable
CREATE TABLE "GlobalCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "globalStatsId" TEXT NOT NULL,
    CONSTRAINT "GlobalCommandStats_globalStatsId_fkey" FOREIGN KEY ("globalStatsId") REFERENCES "GlobalStats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserGlobalCommandStats_userId_idx" ON "UserGlobalCommandStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGlobalCommandStats_userId_commandName_key" ON "UserGlobalCommandStats"("userId", "commandName");

-- CreateIndex
CREATE INDEX "todolist_userId_idx" ON "todolist"("userId");

-- CreateIndex
CREATE INDEX "GuildUserSettings_guildId_idx" ON "GuildUserSettings"("guildId");

-- CreateIndex
CREATE INDEX "GuildUserSettings_userId_idx" ON "GuildUserSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildUserSettings_guildId_userId_key" ON "GuildUserSettings"("guildId", "userId");

-- CreateIndex
CREATE INDEX "UserCommandStats_guildId_idx" ON "UserCommandStats"("guildId");

-- CreateIndex
CREATE INDEX "UserCommandStats_userId_idx" ON "UserCommandStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCommandStats_userId_guildId_commandName_key" ON "UserCommandStats"("userId", "guildId", "commandName");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalCommandStats_globalStatsId_commandName_key" ON "GlobalCommandStats"("globalStatsId", "commandName");
