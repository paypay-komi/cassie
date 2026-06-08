-- CreateTable: GuildDisabledCommand
CREATE TABLE "GuildDisabledCommand" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "command" TEXT NOT NULL,

    CONSTRAINT "GuildDisabledCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuildChannelDisabledCommand
CREATE TABLE "GuildChannelDisabledCommand" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "command" TEXT NOT NULL,

    CONSTRAINT "GuildChannelDisabledCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuildRoleCommandAccess
CREATE TABLE "GuildRoleCommandAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "GuildRoleCommandAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable: GuildUserCommandAccess
CREATE TABLE "GuildUserCommandAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "GuildUserCommandAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildDisabledCommand_guildId_command_key" ON "GuildDisabledCommand"("guildId", "command");
CREATE INDEX "GuildDisabledCommand_guildId_idx" ON "GuildDisabledCommand"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildChannelDisabledCommand_channelId_command_key" ON "GuildChannelDisabledCommand"("channelId", "command");
CREATE INDEX "GuildChannelDisabledCommand_guildId_idx" ON "GuildChannelDisabledCommand"("guildId");
CREATE INDEX "GuildChannelDisabledCommand_channelId_idx" ON "GuildChannelDisabledCommand"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildRoleCommandAccess_guildId_roleId_command_key" ON "GuildRoleCommandAccess"("guildId", "roleId", "command");
CREATE INDEX "GuildRoleCommandAccess_guildId_idx" ON "GuildRoleCommandAccess"("guildId");
CREATE INDEX "GuildRoleCommandAccess_roleId_idx" ON "GuildRoleCommandAccess"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildUserCommandAccess_guildId_userId_command_key" ON "GuildUserCommandAccess"("guildId", "userId", "command");
CREATE INDEX "GuildUserCommandAccess_guildId_idx" ON "GuildUserCommandAccess"("guildId");
CREATE INDEX "GuildUserCommandAccess_userId_idx" ON "GuildUserCommandAccess"("userId");

-- Drop old JSON columns from GuildSettings
ALTER TABLE "GuildSettings"
    DROP COLUMN "disabledCommands",
    DROP COLUMN "roleDisabledCommands",
    DROP COLUMN "userDisabledCommands";

-- Drop old JSON column from ChannelSettings
ALTER TABLE "ChannelSettings"
    DROP COLUMN "disabledCommands";

-- Drop old JSON column from GuildUserSettings
ALTER TABLE "GuildUserSettings"
    DROP COLUMN "disabledCommands";
