const imghash = require("imghash");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Split a 64-bit hex perceptual hash into two 32-bit integers.
 * PostgreSQL BIT_COUNT operates on 32-bit integers, so we split the hash
 * for efficient in-database Hamming distance computation.
 *
 * @param {string} hexHash - 16-char hex string from imghash (64-bit perceptual hash)
 * @returns {{ low: number, high: number }} Two 32-bit signed integers
 */
function hashToInts(hexHash) {
	const half = hexHash.length / 2;
	return {
		low: parseInt(hexHash.slice(0, half), 16),
		high: parseInt(hexHash.slice(half), 16),
	};
}

/**
 * Generate a perceptual hash for a static image or GIF.
 * Uses imghash (pHash algorithm) under the hood.
 *
 * @param {string} filePath - Path to the image/GIF on disk
 * @returns {Promise<string>} 64-bit perceptual hash as a 16-char hex string
 */
async function hashImage(filePath) {
	return await imghash.hash(filePath, 16, "hex");
}

/**
 * Generate a perceptual hash for a video file (MP4, WebM, etc.).
 * Extracts a single scaled frame via ffmpeg, then hashes that frame.
 * Temp frame file is cleaned up in the finally block.
 *
 * @param {string} filePath - Path to the video file on disk
 * @returns {Promise<string>} 64-bit perceptual hash as a 16-char hex string
 */
async function hashVideo(filePath) {
	const tmp = path.join(
		os.tmpdir(),
		`phash_${Date.now()}_${Math.random().toString(36).slice(2)}.png`,
	);
	try {
		await new Promise((res, rej) =>
			execFile(
				"ffmpeg",
				[
					"-i",
					filePath,
					"-vframes",
					"1",
					"-vf",
					"scale=32:32",
					"-y",
					tmp,
				],
				{ timeout: 15000 },
				(err) => (err ? rej(err) : res()),
			),
		);
		return await imghash.hash(tmp, 16, "hex");
	} finally {
		fs.unlink(tmp, () => {});
	}
}

/**
 * Check if a file path points to a video format.
 *
 * @param {string} filePath - File path or URL
 * @returns {boolean} True if the extension matches a known video format
 */
function isVideo(filePath) {
	return /\.(mp4|webm|mov|avi|mkv)$/i.test(filePath);
}

/**
 * Generate a perceptual hash for any supported media file.
 * Automatically detects GIF vs video and routes to the correct hasher.
 *
 * @param {string} filePath - Path to the media file on disk
 * @returns {Promise<string>} 64-bit perceptual hash as a 16-char hex string
 */
async function hashMedia(filePath) {
	if (isVideo(filePath)) return await hashVideo(filePath);
	return await hashImage(filePath);
}

/**
 * Search both ReactionGif and SubmittedReactonGif tables for a perceptual
 * near-duplicate of the given hash. Uses PostgreSQL BIT_COUNT across two
 * 32-bit Int columns for efficient Hamming distance at the database level.
 *
 * @param {import("@prisma/client").PrismaClient} db - Prisma client instance
 * @param {string} hexHash - 16-char perceptual hash from hashMedia/hashImage/hashVideo
 * @param {number} [threshold=10] - Max Hamming distance to consider a match (lower = stricter)
 * @returns {Promise<string|null>} The exact hash of the closest match, or null if none found
 */
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

module.exports = {
	hashMedia,
	hashImage,
	hashVideo,
	hashToInts,
	findNearDuplicate,
};
