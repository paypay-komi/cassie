-- Rename GuildChannelDisabledCommand → GuildChannelCommandAccess
-- and add `allowed` boolean field (true = allow override, false = deny)
-- Existing rows were all "disabled" entries → migrate with allowed = false

CREATE TABLE "GuildChannelCommandAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GuildChannelCommandAccess_pkey" PRIMARY KEY ("id")
);

-- Migrate existing data (all old entries are disables)
INSERT INTO "GuildChannelCommandAccess" ("id", "guildId", "channelId", "commandId", "allowed")
SELECT "id", "guildId", "channelId", "commandId", false FROM "GuildChannelDisabledCommand";

-- Drop old table
DROP TABLE "GuildChannelDisabledCommand";

-- Create indexes
CREATE UNIQUE INDEX "GuildChannelCommandAccess_channelId_commandId_key" ON "GuildChannelCommandAccess"("channelId", "commandId");
CREATE INDEX "GuildChannelCommandAccess_guildId_idx" ON "GuildChannelCommandAccess"("guildId");
CREATE INDEX "GuildChannelCommandAccess_channelId_idx" ON "GuildChannelCommandAccess"("channelId");
