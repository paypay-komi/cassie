-- CreateTable
CREATE TABLE "GuildTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildTag_guildId_name_key" ON "GuildTag"("guildId", "name");

-- CreateIndex
CREATE INDEX "GuildTag_guildId_idx" ON "GuildTag"("guildId");
