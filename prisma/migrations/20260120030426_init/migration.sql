/*
  Warnings:

  - You are about to drop the `CommandStats` table. If the table is not empty, all the data it contains will be lost.
  - The primary key for the `GlobalCommandStats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `commandStatsId` on the `GuildUserSettings` table. All the data in the column will be lost.
  - You are about to drop the column `commandStatsId` on the `UserCommandStats` table. All the data in the column will be lost.
  - Added the required column `globalStatsId` to the `GlobalCommandStats` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `GlobalCommandStats` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `roleDisabledCommands` to the `GuildSettings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userDisabledCommands` to the `GuildSettings` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "CommandStats";
PRAGMA foreign_keys=on;

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
CREATE TABLE "GlobalStats" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global'
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChannelSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "disabledCommands" JSONB NOT NULL,
    "guildId" TEXT NOT NULL,
    CONSTRAINT "ChannelSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChannelSettings" ("channelId", "disabledCommands", "guildId", "id") SELECT "channelId", "disabledCommands", "guildId", "id" FROM "ChannelSettings";
DROP TABLE "ChannelSettings";
ALTER TABLE "new_ChannelSettings" RENAME TO "ChannelSettings";
CREATE TABLE "new_GlobalCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "globalStatsId" TEXT NOT NULL,
    CONSTRAINT "GlobalCommandStats_globalStatsId_fkey" FOREIGN KEY ("globalStatsId") REFERENCES "GlobalStats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GlobalCommandStats" ("commandName", "count", "lastUsed") SELECT "commandName", "count", "lastUsed" FROM "GlobalCommandStats";
DROP TABLE "GlobalCommandStats";
ALTER TABLE "new_GlobalCommandStats" RENAME TO "GlobalCommandStats";
CREATE UNIQUE INDEX "GlobalCommandStats_globalStatsId_commandName_key" ON "GlobalCommandStats"("globalStatsId", "commandName");
CREATE TABLE "new_GuildSettings" (
    "guildId" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT DEFAULT 'c.',
    "disabledCommands" JSONB NOT NULL,
    "roleDisabledCommands" JSONB NOT NULL,
    "userDisabledCommands" JSONB NOT NULL
);
INSERT INTO "new_GuildSettings" ("disabledCommands", "guildId", "prefix") SELECT "disabledCommands", "guildId", "prefix" FROM "GuildSettings";
DROP TABLE "GuildSettings";
ALTER TABLE "new_GuildSettings" RENAME TO "GuildSettings";
CREATE TABLE "new_GuildUserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disabledCommands" JSONB NOT NULL,
    "customPrefix" TEXT,
    "statTracking" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GuildUserSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings" ("guildId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GuildUserSettings" ("customPrefix", "disabledCommands", "guildId", "id", "statTracking", "userId") SELECT "customPrefix", "disabledCommands", "guildId", "id", "statTracking", "userId" FROM "GuildUserSettings";
DROP TABLE "GuildUserSettings";
ALTER TABLE "new_GuildUserSettings" RENAME TO "GuildUserSettings";
CREATE INDEX "GuildUserSettings_guildId_idx" ON "GuildUserSettings"("guildId");
CREATE INDEX "GuildUserSettings_userId_idx" ON "GuildUserSettings"("userId");
CREATE UNIQUE INDEX "GuildUserSettings_guildId_userId_key" ON "GuildUserSettings"("guildId", "userId");
CREATE TABLE "new_UserCommandStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_UserCommandStats" ("commandName", "count", "guildId", "id", "lastUsed", "userId") SELECT "commandName", "count", "guildId", "id", "lastUsed", "userId" FROM "UserCommandStats";
DROP TABLE "UserCommandStats";
ALTER TABLE "new_UserCommandStats" RENAME TO "UserCommandStats";
CREATE INDEX "UserCommandStats_guildId_idx" ON "UserCommandStats"("guildId");
CREATE INDEX "UserCommandStats_userId_idx" ON "UserCommandStats"("userId");
CREATE UNIQUE INDEX "UserCommandStats_userId_guildId_commandName_key" ON "UserCommandStats"("userId", "guildId", "commandName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
