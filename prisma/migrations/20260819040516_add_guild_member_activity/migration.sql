-- CreateTable
CREATE TABLE "GuildMemberActivity" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "voiceSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuildMemberActivity_pkey" PRIMARY KEY ("guildId","userId")
);
