-- Rename command -> commandId in all 4 access control tables
-- Drop old unique indexes, rename columns, recreate indexes with correct names

DROP INDEX IF EXISTS "GuildDisabledCommand_guildId_command_key";
ALTER TABLE "GuildDisabledCommand" RENAME COLUMN "command" TO "commandId";
CREATE UNIQUE INDEX "GuildDisabledCommand_guildId_commandId_key" ON "GuildDisabledCommand"("guildId", "commandId");

DROP INDEX IF EXISTS "GuildChannelDisabledCommand_channelId_command_key";
ALTER TABLE "GuildChannelDisabledCommand" RENAME COLUMN "command" TO "commandId";
CREATE UNIQUE INDEX "GuildChannelDisabledCommand_channelId_commandId_key" ON "GuildChannelDisabledCommand"("channelId", "commandId");

DROP INDEX IF EXISTS "GuildRoleCommandAccess_guildId_roleId_command_key";
ALTER TABLE "GuildRoleCommandAccess" RENAME COLUMN "command" TO "commandId";
CREATE UNIQUE INDEX "GuildRoleCommandAccess_guildId_roleId_commandId_key" ON "GuildRoleCommandAccess"("guildId", "roleId", "commandId");

DROP INDEX IF EXISTS "GuildUserCommandAccess_guildId_userId_command_key";
ALTER TABLE "GuildUserCommandAccess" RENAME COLUMN "command" TO "commandId";
CREATE UNIQUE INDEX "GuildUserCommandAccess_guildId_userId_commandId_key" ON "GuildUserCommandAccess"("guildId", "userId", "commandId");
