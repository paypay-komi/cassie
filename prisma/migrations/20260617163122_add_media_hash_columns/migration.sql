ALTER TABLE "ReactionGif" ADD COLUMN "mediaHashLow" Int;
ALTER TABLE "ReactionGif" ADD COLUMN "mediaHashHigh" Int;
CREATE INDEX IF NOT EXISTS "ReactionGif_mediaHashHigh_mediaHashLow_idx" ON "ReactionGif" ("mediaHashHigh", "mediaHashLow");

ALTER TABLE "SubmittedReactonGif" ADD COLUMN "mediaHashLow" Int;
ALTER TABLE "SubmittedReactonGif" ADD COLUMN "mediaHashHigh" Int;
CREATE INDEX IF NOT EXISTS "SubmittedReactonGif_mediaHashHigh_mediaHashLow_idx" ON "SubmittedReactonGif" ("mediaHashHigh", "mediaHashLow");
