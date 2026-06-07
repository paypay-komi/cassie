-- AlterTable
ALTER TABLE "reminder" ADD COLUMN "remindInChannel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reminder" ADD COLUMN "channelId" TEXT;
