-- DropForeignKey
ALTER TABLE "ChannelSettings" DROP CONSTRAINT "ChannelSettings_guildId_fkey";

-- DropForeignKey
ALTER TABLE "EchoMessage" DROP CONSTRAINT "EchoMessage_channelId_fkey";

-- DropForeignKey
ALTER TABLE "GuildUserSettings" DROP CONSTRAINT "GuildUserSettings_guildId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "EchoChannel_channelId_guildId_key" ON "EchoChannel"("channelId", "guildId");

-- AddForeignKey
ALTER TABLE "GuildTag" ADD CONSTRAINT "GuildTag_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSettings" ADD CONSTRAINT "ChannelSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildUserSettings" ADD CONSTRAINT "GuildUserSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchoChannel" ADD CONSTRAINT "EchoChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchoMessage" ADD CONSTRAINT "EchoMessage_channelId_guildId_fkey" FOREIGN KEY ("channelId", "guildId") REFERENCES "EchoChannel"("channelId", "guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildAnnouncement" ADD CONSTRAINT "GuildAnnouncement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
