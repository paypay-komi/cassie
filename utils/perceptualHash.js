const imghash = require("imghash");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

function hashToInts(hexHash) {
  const half = hexHash.length / 2;
  return {
    low: parseInt(hexHash.slice(0, half), 16),
    high: parseInt(hexHash.slice(half), 16),
  };
}

async function hashImage(filePath) {
  return await imghash.hash(filePath, 16, "hex");
}

async function hashVideo(filePath) {
  const tmp = path.join(os.tmpdir(), `phash_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  try {
    await new Promise((res, rej) =>
      execFile("ffmpeg", [
        "-i", filePath,
        "-vframes", "1",
        "-vf", "scale=32:32",
        "-y", tmp,
      ], { timeout: 15000 }, (err) => err ? rej(err) : res())
    );
    return await imghash.hash(tmp, 16, "hex");
  } finally {
    fs.unlink(tmp, () => {});
  }
}

function isVideo(filePath) {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(filePath);
}

async function hashMedia(filePath) {
  if (isVideo(filePath)) return await hashVideo(filePath);
  return await hashImage(filePath);
}

async function findNearDuplicate(db, hexHash, threshold = 10) {
  const { low, high } = hashToInts(hexHash);
  const rows = await db.$queryRaw`
    SELECT hash, BIT_COUNT((("mediaHashHigh" # ${high})::bit(32))) +
                BIT_COUNT((("mediaHashLow"  # ${low})::bit(32))) AS distance
    FROM (
      SELECT hash, "mediaHashLow", "mediaHashHigh" FROM "ReactionGif"
      WHERE "mediaHashLow" IS NOT NULL
      UNION ALL
      SELECT hash, "mediaHashLow", "mediaHashHigh" FROM "SubmittedReactonGif"
      WHERE "mediaHashLow" IS NOT NULL
    ) combined
    WHERE BIT_COUNT((("mediaHashHigh" # ${high})::bit(32))) +
          BIT_COUNT((("mediaHashLow"  # ${low})::bit(32))) <= ${threshold}
    ORDER BY distance
    LIMIT 1
  `;
  return rows?.[0]?.hash || null;
}

module.exports = { hashMedia, hashImage, hashVideo, hashToInts, findNearDuplicate };
