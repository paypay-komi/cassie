-- AlterTable
ALTER TABLE "GuildEconomy" ADD COLUMN     "workStreakBonus" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "workStreakDecayInterval" INTEGER NOT NULL DEFAULT 1800;

-- AlterTable
ALTER TABLE "GuildEconomyUser" ADD COLUMN     "workStreak" INTEGER NOT NULL DEFAULT 0;
