-- CreateTable
CREATE TABLE "GuildEconomy" (
    "guildId" TEXT NOT NULL,
    "currencyName" TEXT NOT NULL DEFAULT 'Cass Bit',
    "currencyNamePlural" TEXT NOT NULL DEFAULT 'Cass Bits',
    "currencySymbol" TEXT NOT NULL DEFAULT '??',
    "dailyBase" INTEGER NOT NULL DEFAULT 100,
    "dailyStreakBonus" INTEGER NOT NULL DEFAULT 25,
    "dailyCap" INTEGER NOT NULL DEFAULT 1000,
    "streakResetDays" INTEGER NOT NULL DEFAULT 1,
    "workMin" INTEGER NOT NULL DEFAULT 10,
    "workMax" INTEGER NOT NULL DEFAULT 50,
    "workCooldown" INTEGER NOT NULL DEFAULT 60,
    "taxRate" INTEGER NOT NULL DEFAULT 0,
    "economyChannel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuildEconomy_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "GuildEconomyUser" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "lastDaily" TIMESTAMP(3),
    "lastWork" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuildEconomyUser_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateTable
CREATE TABLE "GuildEconomyTransaction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "relatedUserId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuildEconomyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuildEconomyUser_guildId_idx" ON "GuildEconomyUser"("guildId");

-- CreateIndex
CREATE INDEX "GuildEconomyTransaction_guildId_userId_idx" ON "GuildEconomyTransaction"("guildId", "userId");

-- CreateIndex
CREATE INDEX "GuildEconomyTransaction_guildId_createdAt_idx" ON "GuildEconomyTransaction"("guildId", "createdAt");

-- AddForeignKey
ALTER TABLE "GuildEconomyUser" ADD CONSTRAINT "GuildEconomyUser_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildEconomy"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildEconomyTransaction" ADD CONSTRAINT "GuildEconomyTransaction_guildId_userId_fkey" FOREIGN KEY ("guildId", "userId") REFERENCES "GuildEconomyUser"("guildId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
