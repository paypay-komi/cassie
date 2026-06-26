-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('VOTING', 'GUILTY', 'NOT_GUILTY', 'DISMISSED');

-- AlterTable
ALTER TABLE "GuildEconomy" ALTER COLUMN "currencySymbol" SET DEFAULT '🐰';

-- CreateTable
CREATE TABLE "UserGlobalCommandStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGlobalCommandStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettingsObject" (
    "id" TEXT NOT NULL DEFAULT 'guild_settings',
    "data" JSONB NOT NULL,

    CONSTRAINT "GuildSettingsObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDataObject" (
    "id" TEXT NOT NULL DEFAULT 'user_data',
    "data" JSONB NOT NULL,

    CONSTRAINT "UserDataObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todolist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "todolist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repeatingSecs" INTEGER,
    "remindInChannel" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,

    CONSTRAINT "reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildSettings" (
    "guildId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'c.',
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GuildSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "UserPrefix" (
    "userId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,

    CONSTRAINT "UserPrefix_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "GuildTag" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT,
    "channelId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalAfkUser" (
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoReply" BOOLEAN NOT NULL DEFAULT true,
    "ignoreBots" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnPing" BOOLEAN NOT NULL DEFAULT true,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalAfkUser_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "userTimezone" (
    "userId" TEXT NOT NULL,
    "minsOffset" INTEGER NOT NULL DEFAULT 0,
    "timeZoneString" TEXT DEFAULT 'NONE',
    "timeFormat" TEXT DEFAULT '12H',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "userTimezone_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "GlobalAfkMention" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "mentionedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalAfkMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSettings" (
    "id" SERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,

    CONSTRAINT "ChannelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildUserSettings" (
    "id" SERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statTracking" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GuildUserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCommandStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCommandStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalStats" (
    "id" TEXT NOT NULL DEFAULT 'global',

    CONSTRAINT "GlobalStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalCommandStats" (
    "id" TEXT NOT NULL,
    "commandName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "globalStatsId" TEXT NOT NULL,

    CONSTRAINT "GlobalCommandStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "aiResult" TEXT,
    "aiReason" TEXT,
    "aiThoughts" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiCategory" TEXT,
    "aiImprovedIdea" TEXT,
    "aiDuplicateOf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vote_score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVoteStats" (
    "userId" TEXT NOT NULL,
    "lastVote" TIMESTAMP(3),
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "voteStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedReward" TIMESTAMP(3),
    "voteDmOptOut" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVoteStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "IdeaVote" (
    "id" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdeaVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DblVote" (
    "userId" TEXT NOT NULL,
    "lastVote" TIMESTAMP(3),
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "voteStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedReward" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DblVote_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "defendantId" TEXT NOT NULL,
    "prosecutorId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT,
    "threadId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "CourtStatus" NOT NULL DEFAULT 'VOTING',
    "voteDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CourtCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtVote" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildDisabledCommand" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,

    CONSTRAINT "GuildDisabledCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildChannelCommandAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GuildChannelCommandAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildRoleCommandAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "GuildRoleCommandAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildUserCommandAccess" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commandId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL,

    CONSTRAINT "GuildUserCommandAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchoChannel" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "echoChance" DOUBLE PRECISION DEFAULT 85,
    "deleteDelayMin" INTEGER DEFAULT 10000,
    "deleteDelayMax" INTEGER DEFAULT 300000,
    "echoDelayMin" INTEGER DEFAULT 0,
    "echoDelayMax" INTEGER DEFAULT 86400000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EchoChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EchoMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deliverAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalMessageId" TEXT,
    "attachments" JSONB,
    "poll" JSONB,
    "embeds" JSONB,

    CONSTRAINT "EchoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeCapsule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sendAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeCapsule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sid" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildAnnouncement" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "webhookId" TEXT,
    "webhookToken" TEXT,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "lastNagged" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildAnnouncement_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "InviteClick" (
    "id" SERIAL NOT NULL,
    "state" TEXT,
    "ref" TEXT NOT NULL DEFAULT 'unknown',
    "ip" TEXT,
    "userAgent" TEXT,
    "guildId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionGif" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "actions" TEXT[],
    "fileType" TEXT NOT NULL,
    "mediaHash" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionGif_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactionGifReport" (
    "gifId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ReactionGifReport_pkey" PRIMARY KEY ("gifId","action","userId")
);

-- CreateTable
CREATE TABLE "SubmittedReactonGif" (
    "id" TEXT NOT NULL,
    "actions" TEXT[],
    "hash" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mediaHash" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "pending" BOOLEAN NOT NULL DEFAULT true,
    "submittedBy" TEXT NOT NULL,
    "approvedBy" TEXT,

    CONSTRAINT "SubmittedReactonGif_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserGlobalCommandStats_userId_idx" ON "UserGlobalCommandStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserGlobalCommandStats_userId_commandName_key" ON "UserGlobalCommandStats"("userId", "commandName");

-- CreateIndex
CREATE INDEX "todolist_userId_idx" ON "todolist"("userId");

-- CreateIndex
CREATE INDEX "reminder_userId_idx" ON "reminder"("userId");

-- CreateIndex
CREATE INDEX "GuildTag_guildId_idx" ON "GuildTag"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildTag_guildId_name_key" ON "GuildTag"("guildId", "name");

-- CreateIndex
CREATE INDEX "ChatMessage_userId_createdAt_idx" ON "ChatMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GlobalAfkMention_userId_idx" ON "GlobalAfkMention"("userId");

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

-- CreateIndex
CREATE INDEX "IdeaVote_ideaId_idx" ON "IdeaVote"("ideaId");

-- CreateIndex
CREATE INDEX "IdeaVote_userId_idx" ON "IdeaVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IdeaVote_ideaId_userId_key" ON "IdeaVote"("ideaId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_messageId_key" ON "CourtCase"("messageId");

-- CreateIndex
CREATE INDEX "CourtVote_voterId_idx" ON "CourtVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "CourtVote_caseId_voterId_key" ON "CourtVote"("caseId", "voterId");

-- CreateIndex
CREATE INDEX "GuildDisabledCommand_guildId_idx" ON "GuildDisabledCommand"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildDisabledCommand_guildId_commandId_key" ON "GuildDisabledCommand"("guildId", "commandId");

-- CreateIndex
CREATE INDEX "GuildChannelCommandAccess_guildId_idx" ON "GuildChannelCommandAccess"("guildId");

-- CreateIndex
CREATE INDEX "GuildChannelCommandAccess_channelId_idx" ON "GuildChannelCommandAccess"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildChannelCommandAccess_channelId_commandId_key" ON "GuildChannelCommandAccess"("channelId", "commandId");

-- CreateIndex
CREATE INDEX "GuildRoleCommandAccess_guildId_idx" ON "GuildRoleCommandAccess"("guildId");

-- CreateIndex
CREATE INDEX "GuildRoleCommandAccess_roleId_idx" ON "GuildRoleCommandAccess"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildRoleCommandAccess_guildId_roleId_commandId_key" ON "GuildRoleCommandAccess"("guildId", "roleId", "commandId");

-- CreateIndex
CREATE INDEX "GuildUserCommandAccess_guildId_idx" ON "GuildUserCommandAccess"("guildId");

-- CreateIndex
CREATE INDEX "GuildUserCommandAccess_userId_idx" ON "GuildUserCommandAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildUserCommandAccess_guildId_userId_commandId_key" ON "GuildUserCommandAccess"("guildId", "userId", "commandId");

-- CreateIndex
CREATE UNIQUE INDEX "EchoChannel_channelId_key" ON "EchoChannel"("channelId");

-- CreateIndex
CREATE INDEX "EchoChannel_guildId_idx" ON "EchoChannel"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "EchoChannel_channelId_guildId_key" ON "EchoChannel"("channelId", "guildId");

-- CreateIndex
CREATE INDEX "EchoMessage_deliverAt_idx" ON "EchoMessage"("deliverAt");

-- CreateIndex
CREATE INDEX "EchoMessage_channelId_deliverAt_idx" ON "EchoMessage"("channelId", "deliverAt");

-- CreateIndex
CREATE INDEX "TimeCapsule_sendAt_idx" ON "TimeCapsule"("sendAt");

-- CreateIndex
CREATE INDEX "TimeCapsule_userId_sendAt_idx" ON "TimeCapsule"("userId", "sendAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sid_key" ON "Session"("sid");

-- CreateIndex
CREATE UNIQUE INDEX "InviteClick_state_key" ON "InviteClick"("state");

-- CreateIndex
CREATE INDEX "InviteClick_ref_idx" ON "InviteClick"("ref");

-- CreateIndex
CREATE INDEX "InviteClick_guildId_idx" ON "InviteClick"("guildId");

-- CreateIndex
CREATE INDEX "InviteClick_createdAt_idx" ON "InviteClick"("createdAt");

-- CreateIndex
CREATE INDEX "InviteClick_state_idx" ON "InviteClick"("state");

-- CreateIndex
CREATE UNIQUE INDEX "ReactionGif_hash_key" ON "ReactionGif"("hash");

-- CreateIndex
CREATE INDEX "ReactionGif_hash_actions_idx" ON "ReactionGif"("hash", "actions");

-- CreateIndex
CREATE INDEX "ReactionGif_mediaHash_idx" ON "ReactionGif"("mediaHash");

-- CreateIndex
CREATE INDEX "ReactionGifReport_action_idx" ON "ReactionGifReport"("action");

-- CreateIndex
CREATE UNIQUE INDEX "SubmittedReactonGif_hash_key" ON "SubmittedReactonGif"("hash");

-- CreateIndex
CREATE INDEX "SubmittedReactonGif_hash_actions_idx" ON "SubmittedReactonGif"("hash", "actions");

-- CreateIndex
CREATE INDEX "SubmittedReactonGif_mediaHash_idx" ON "SubmittedReactonGif"("mediaHash");

-- AddForeignKey
ALTER TABLE "GuildTag" ADD CONSTRAINT "GuildTag_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalAfkMention" ADD CONSTRAINT "GlobalAfkMention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GlobalAfkUser"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSettings" ADD CONSTRAINT "ChannelSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildUserSettings" ADD CONSTRAINT "GuildUserSettings_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalCommandStats" ADD CONSTRAINT "GlobalCommandStats_globalStatsId_fkey" FOREIGN KEY ("globalStatsId") REFERENCES "GlobalStats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdeaVote" ADD CONSTRAINT "IdeaVote_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "Idea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtVote" ADD CONSTRAINT "CourtVote_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CourtCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildDisabledCommand" ADD CONSTRAINT "GuildDisabledCommand_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildChannelCommandAccess" ADD CONSTRAINT "GuildChannelCommandAccess_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildRoleCommandAccess" ADD CONSTRAINT "GuildRoleCommandAccess_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildUserCommandAccess" ADD CONSTRAINT "GuildUserCommandAccess_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchoChannel" ADD CONSTRAINT "EchoChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EchoMessage" ADD CONSTRAINT "EchoMessage_channelId_guildId_fkey" FOREIGN KEY ("channelId", "guildId") REFERENCES "EchoChannel"("channelId", "guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildAnnouncement" ADD CONSTRAINT "GuildAnnouncement_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildSettings"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactionGifReport" ADD CONSTRAINT "ReactionGifReport_gifId_fkey" FOREIGN KEY ("gifId") REFERENCES "ReactionGif"("id") ON DELETE CASCADE ON UPDATE CASCADE;
