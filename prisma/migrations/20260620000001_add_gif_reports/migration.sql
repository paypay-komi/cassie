-- Drop old ReactionGifReport table
DROP TABLE IF EXISTS "ReactionGifReport";

-- CreateTable with compound PK including userId
CREATE TABLE "ReactionGifReport" (
    "gifId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ReactionGifReport_pkey" PRIMARY KEY ("gifId", "action", "userId")
);

-- CreateIndex
CREATE INDEX "ReactionGifReport_action_idx" ON "ReactionGifReport"("action");

-- AddForeignKey
ALTER TABLE "ReactionGifReport" ADD CONSTRAINT "ReactionGifReport_gifId_fkey" FOREIGN KEY ("gifId") REFERENCES "ReactionGif"("id") ON DELETE CASCADE ON UPDATE CASCADE;
