const sharp = require("sharp");

/**
 * Read the first frame of a GIF as a PNG buffer.
 * Falls through for non-GIF files (returns null).
 */
async function gifToPngBuffer(filePath) {
	if (!/\.gif$/i.test(filePath)) return null;
	const gifFrames = require("gif-frames");
	const frames = await gifFrames({ url: filePath, frames: 0, outputType: "png" });
	const stream = frames[0].getImage();
	return new Promise((resolve, reject) => {
		const chunks = [];
		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => resolve(Buffer.concat(chunks)));
		stream.on("error", reject);
	});
}

/**
 * Average hash (aHash) — resize to 8×8 grayscale, compute mean,
 * produce a 64-bit binary hash as 16 hex chars.
 *
 * @param {string} filePath - Path to the image/GIF on disk
 * @returns {Promise<{ hex: string, bigint: bigint }>}
 */
async function hashImage(filePath) {
	const buf = await gifToPngBuffer(filePath);
	const input = buf || filePath;

	const { data } = await sharp(input)
		.resize(8, 8, { fit: "fill" })
		.grayscale()
		.raw()
		.toBuffer({ resolveWithObject: true });

	// 8×8 = 64 pixels, each is 1 byte (grayscale)
	let sum = 0;
	for (let i = 0; i < 64; i++) sum += data[i];
	const avg = sum / 64;

	// Build 64-bit hash: each bit = 1 if pixel > avg
	let bits = 0n;
	for (let i = 0; i < 64; i++) {
		if (data[i] > avg) bits |= 1n << BigInt(i);
	}

	const hex = bits.toString(16).padStart(16, "0");
	return { hex, bigint: bits };
}

/**
 * Convert a 16-char hex perceptual hash to BigInt.
 */
function hexToBigInt(hex) {
	return BigInt("0x" + hex);
}

/**
 * Search ReactionGif and SubmittedReactonGif for a perceptual near-duplicate.
 *
 * @param {import("@prisma/client").PrismaClient} db
 * @param {string | { hex: string, bigint: bigint }} hash
 * @param {number} [threshold=10]
 * @returns {Promise<{ id: string, hash: string }|null>}
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
	hashImage,
	hexToBigInt,
	findNearDuplicate,
};
