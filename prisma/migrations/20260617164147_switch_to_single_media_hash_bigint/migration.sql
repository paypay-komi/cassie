ALTER TABLE "ReactionGif" DROP COLUMN "mediaHashLow", DROP COLUMN "mediaHashHigh", ADD COLUMN "mediaHash" BIGINT;
ALTER TABLE "SubmittedReactonGif" DROP COLUMN "mediaHashLow", DROP COLUMN "mediaHashHigh", ADD COLUMN "mediaHash" BIGINT;
CREATE INDEX "ReactionGif_mediaHash_idx" ON "ReactionGif" ("mediaHash");
CREATE INDEX "SubmittedReactonGif_mediaHash_idx" ON "SubmittedReactonGif" ("mediaHash");
