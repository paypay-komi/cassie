const imghash = require("imghash");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Convert a 16-char hex perceptual hash to a single BigInt.
 *
 * @param {string} hex - 16-char hex string from imghash
 * @returns {bigint}
 */
function hexToBigInt(hex) {
	return BigInt("0x" + hex);
}

/**
 * Generate a perceptual hash for a static image or GIF.
 *
 * @param {string} filePath - Path to the image/GIF on disk
 * @returns {Promise<{ hex: string, bigint: bigint }>}
 */
async function hashImage(filePath) {
	const hex = await imghash.hash(filePath, 16, "hex");
	return { hex, bigint: hexToBigInt(hex) };
}

/**
 * Generate a perceptual hash for a video file (MP4, WebM, etc.).
 * Extracts a single scaled frame via ffmpeg, then hashes that frame.
 * Temp file is cleaned up in the finally block.
 *
 * @param {string} filePath - Path to the video file on disk
 * @returns {Promise<{ hex: string, bigint: bigint }>}
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
		const hex = await imghash.hash(tmp, 16, "hex");
		return { hex, bigint: hexToBigInt(hex) };
	} finally {
		fs.unlink(tmp, () => {});
	}
}

/**
 * Check if a file path points to a video format.
 *
 * @param {string} filePath - File path or URL
 * @returns {boolean}
 */
function isVideo(filePath) {
	return /\.(mp4|webm|mov|avi|mkv)$/i.test(filePath);
}

/**
 * Generate a perceptual hash for any supported media file.
 * Routes static images to imghash, GIFs/videos to ffmpeg + imghash.
 * (imghash's underlying canvas/image doesn't support GIF)
 *
 * @param {string} filePath - Path to the media file on disk
 * @returns {Promise<{ hex: string, bigint: bigint }>}
 */
async function hashMedia(filePath) {
	if (/\.gif$/i.test(filePath) || isVideo(filePath)) return await hashVideo(filePath);
	return await hashImage(filePath);
}

/**
 * Search ReactionGif and SubmittedReactonGif for a perceptual near-duplicate.
 * Uses PostgreSQL BIT_COUNT on a single bit(64) column — can't be done with
 * Prisma's standard query builder since bitwise ops are database-specific.
 *
 * @param {import("@prisma/client").PrismaClient} db - Prisma client
 * @param {string | { hex: string, bigint: bigint }} hash - Perceptual hash (hex string or object from hashMedia)
 * @param {number} [threshold=10] - Max Hamming distance (lower = stricter)
 * @returns {Promise<{ id: string, hash: string }|null>} The id and hash of the closest match, or null
 */
async function findNearDuplicate(db, hash, threshold = 10) {
	const val = typeof hash === "string" ? BigInt("0x" + hash) : hash.bigint;
	const rows = await db.$queryRaw`
    SELECT id, hash, BIT_COUNT(("mediaHash" # ${val})::bit(64)) AS distance
    FROM (
      SELECT id, hash, "mediaHash" FROM "ReactionGif" WHERE "mediaHash" IS NOT NULL
      UNION ALL
      SELECT id, hash, "mediaHash" FROM "SubmittedReactonGif" WHERE "mediaHash" IS NOT NULL
    ) combined
    WHERE BIT_COUNT(("mediaHash" # ${val})::bit(64)) <= ${threshold}
    ORDER BY distance
    LIMIT 1
  `;
	return rows?.[0] ? { id: rows[0].id, hash: rows[0].hash } : null;
}

module.exports = {
	hashMedia,
	hashImage,
	hashVideo,
	hexToBigInt,
	findNearDuplicate,
};
