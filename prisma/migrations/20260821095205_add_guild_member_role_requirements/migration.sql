-- CreateTable
CREATE TABLE "GuildMemberRoleRequirement" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuildMemberRoleRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildMemberRoleRequirement_guildId_idx" ON "GuildMemberRoleRequirement"("guildId");

-- CreateIndex
CREATE INDEX "GuildMemberRoleRequirement_roleId_idx" ON "GuildMemberRoleRequirement"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "GuildMemberRoleRequirement_guildId_roleId_key" ON "GuildMemberRoleRequirement"("guildId", "roleId");
