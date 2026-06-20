/**
 * Bulk import reaction GIFs from the gifukai API (free, no API key).
 *
 * https://api.gifukai.com — 1,029 anime reaction GIFs across 44 actions.
 * Maps gifukai action names to our action names, downloads, hashes,
 * deduplicates, and stores in DB + L:\reactiongifs\.
 *
 * Usage: node scripts/importGifukai.js
 *
 * Set RESUME=1 to skip already-imported IDs (checks L:\reactiongifs\ for existing files).
 */

require("dotenv/config");
const { PrismaClient } = require("../generated/prisma/client.ts");
const { PrismaPg } = require("@prisma/adapter-pg");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const sharp = require("sharp");

// ── DB setup ──
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ── Config ──
const GIF_DIR = "L:\\reactiongifs";
const API_BASE = "https://api.gifukai.com";
const PAGE_SIZE = 200;
const MAX_SIGNED_64 = 1n << 63n;

// ── Action mapping: gifukai action → our action tag(s) ──
const ACTION_MAP = {
	angry: ["angry", "mad", "rage", "crashout"],
	bite: ["bite"],
	blowkiss: ["blowkiss"],
	blush: ["blush"],
	bonk: ["bonk"],
	carry: ["carry"],
	clap: ["clap", "cheer"],
	cry: ["cry", "sob"],
	cuddle: ["cuddle", "snuggle"],
	dance: ["dance"],
	eat: ["eat", "nom"],
	facepalm: ["facepalm"],
	feed: ["feed"],
	happy: ["happy", "smile", "grin", "cheer", "excited", "celebrate"],
	hi: ["wave"],
	highfive: ["highfive", "fistbump"],
	hug: ["hug"],
	kick: ["kick"],
	kill: ["kill"],
	kiss: ["kiss", "kisscheek"],
	laugh: ["laugh"],
	nod: ["nod", "bow"],
	nope: ["facepalm", "shoo"],
	pat: ["pat", "headpat", "headrub"],
	peek: ["peek"],
	poke: ["poke"],
	pout: ["pout"],
	punch: ["punch"],
	run: ["run"],
	shrug: ["shrug"],
	shy: ["shy", "blush", "sweat"],
	sip: ["sip", "tea", "coffee"],
	slap: ["slap"],
	sleep: ["sleep", "yawn"],
	smile: ["smile", "grin"],
	smug: ["smirk", "smug"],
	stare: ["stare", "glare"],
	taunt: ["tease", "taunt"],
	think: ["think", "ponder"],
	thumbsup: ["thumbsup", "approve"],
	tickle: ["tickle"],
	wallslam: ["slam"],
	wave: ["wave"],
	wink: ["wink"],
};

// ── Perceptual hash (same algo as utils/perceptualHash.js) ──

/** Convert unsigned 64-bit BigInt to signed 64-bit (PostgreSQL BIGINT). */
function toSigned64(val) {
	if (val >= MAX_SIGNED_64) return val - (MAX_SIGNED_64 << 1n);
	return val;
}

/** Read first frame of a GIF as PNG buffer. */
async function gifToPngBuffer(filePath) {
	if (!/\.gif$/i.test(filePath)) return null;
	const gifFrames = require("gif-frames");
	const frames = await gifFrames({
		url: filePath,
		frames: 0,
		outputType: "png",
	});
	const stream = frames[0].getImage();
	return new Promise((resolve, reject) => {
		const chunks = [];
		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => resolve(Buffer.concat(chunks)));
		stream.on("error", reject);
	});
}

/** Average hash (aHash) — 8×8 grayscale → 64-bit hash. */
async function hashImage(filePath) {
	const buf = await gifToPngBuffer(filePath);
	const input = buf || filePath;
	const { data } = await sharp(input)
		.resize(8, 8, { fit: "fill" })
		.grayscale()
		.raw()
		.toBuffer({ resolveWithObject: true });

	let sum = 0;
	for (let i = 0; i < 64; i++) sum += data[i];
	const avg = sum / 64;

	let bits = 0n;
	for (let i = 0; i < 64; i++) {
		if (data[i] > avg) bits |= 1n << BigInt(i);
	}

	const hex = bits.toString(16).padStart(16, "0");
	return { hex, bigint: toSigned64(bits) };
}

/** Check for near-duplicate via BIT_COUNT on mediaHash. */
async function findNearDuplicate(phashBigint, threshold = 10) {
	const rows = await prisma.$queryRaw`
		SELECT id, hash, BIT_COUNT(("mediaHash" # ${phashBigint})::bit(64)) AS distance
		FROM (
			SELECT id, hash, "mediaHash" FROM "ReactionGif" WHERE "mediaHash" IS NOT NULL
			UNION ALL
			SELECT id, hash, "mediaHash" FROM "SubmittedReactonGif" WHERE "mediaHash" IS NOT NULL
		) combined
		WHERE BIT_COUNT(("mediaHash" # ${phashBigint})::bit(64)) <= ${threshold}
		ORDER BY distance
		LIMIT 1
	`;
	return rows?.[0] ? { id: rows[0].id, hash: rows[0].hash } : null;
}

// ── Helpers ──

function progressBar(pct, label = "") {
	const filled = Math.round(pct / 10);
	const empty = 10 - filled;
	const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
	return `${label} ${bar} ${pct}%`;
}

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms) {
	const s = Math.floor(ms / 1000);
	const m = Math.floor(s / 60);
	const h = Math.floor(m / 60);
	if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
	if (m > 0) return `${m}m ${s % 60}s`;
	return `${s}s`;
}

/** Download a file from URL to local path with progress callback. */
async function download(url, dest, onProgress) {
	const writer = fs.createWriteStream(dest);
	const response = await axios({
		method: "get",
		url,
		responseType: "stream",
		timeout: 60000,
	});
	const total = parseInt(response.headers["content-length"], 10);
	let received = 0;
	response.data.on("data", (chunk) => {
		received += chunk.length;
		if (total && onProgress) onProgress(received, total);
	});
	await new Promise((resolve, reject) => {
		writer.on("finish", resolve);
		writer.on("error", reject);
		response.data.pipe(writer);
	});
	return total;
}

/** Fetch all GIF metadata from gifukai library with pagination. */
async function fetchAllLibraryGifs() {
	const all = [];
	let offset = 0;
	while (true) {
		const url = `${API_BASE}/library?limit=${PAGE_SIZE}&offset=${offset}`;
		const { data } = await axios.get(url, { timeout: 15000 });
		all.push(...data.gifs);
		if (offset + PAGE_SIZE >= data.total) break;
		offset += PAGE_SIZE;
	}
	return all;
}

// ── Main ──

async function main() {
	fs.mkdirSync(GIF_DIR, { recursive: true });

	console.log("=== gifukai Bulk Import ===\n");
	console.log(`GIF storage: ${GIF_DIR}\n`);

	// 1. Fetch library
	console.log("Fetching library metadata from gifukai API...");
	const gifs = await fetchAllLibraryGifs();
	console.log(`  Found ${gifs.length} GIFs across ${new Set(gifs.map((g) => g.action)).size} actions\n`);

	// 2. Count per action
	const counts = {};
	for (const g of gifs) {
		counts[g.action] = (counts[g.action] || 0) + 1;
	}
	console.log("GIFs per action:");
	for (const [action, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
		const mapped = ACTION_MAP[action]?.join(", ") || "?";
		console.log(`  ${action.padEnd(12)} ${String(count).padStart(4)} → ${mapped}`);
	}

	// 3. Pre-collect existing hashes for fast duplicate check
	console.log("\nLoading existing DB hashes for duplicate detection...");
	const existingGifs = await prisma.reactionGif.findMany({ select: { hash: true } });
	const existingSubmitted = await prisma.submittedReactonGif.findMany({ select: { hash: true } });
	const existingHashSet = new Set([
		...existingGifs.map((r) => r.hash),
		...existingSubmitted.map((r) => r.hash),
	]);
	console.log(`  ${existingHashSet.size} hashes already in DB\n`);

	// 4. Process each GIF
	let imported = 0;
	let skipped = 0;
	let errors = 0;
	let dupExact = 0;
	let dupNear = 0;
	const total = gifs.length;
	const startTime = Date.now();

	for (let i = 0; i < total; i++) {
		const gif = gifs[i];
		const pct = Math.round(((i + 1) / total) * 100);
		const elapsed = Date.now() - startTime;
		const rate = elapsed > 0 ? Math.round((i + 1) / (elapsed / 1000)) : 0;
		const remaining = rate > 0 ? Math.round((total - i - 1) / rate) : 0;

		const ourActions = ACTION_MAP[gif.action];
		if (!ourActions) {
			// No mapping for this action — skip
			continue;
		}

		const isWebp = gif.content_type === "image/webp" || gif.filename.endsWith(".webp");
		const ext = isWebp ? "webp" : "gif";

		const statusLine = `[${i + 1}/${total}] ${progressBar(pct)} | ${rate}/s | ETA: ${formatDuration(remaining)}s`;

		try {
			// Download to temp
			const tmp = path.join(os.tmpdir(), `gifukai_${gif.id}_${Date.now()}.${ext}`);
			await download(gif.url, tmp);

			// SHA256 hash
			const shaHash = await new Promise((res, rej) => {
				const h = crypto.createHash("sha256");
				fs.createReadStream(tmp)
					.on("data", (d) => h.update(d))
					.on("end", () => res(h.digest("hex")))
					.on("error", rej);
			});

			// Check exact duplicate
			if (existingHashSet.has(shaHash)) {
				fs.unlink(tmp, () => {});
				dupExact++;
				if ((i + 1) % 50 === 0 || i === total - 1) {
					console.log(`${statusLine} ⏭ exact dup (skipped)`);
				}
				continue;
			}

			// Perceptual hash
			const phash = await hashImage(tmp);

			// Check near duplicate
			const nearDup = await findNearDuplicate(phash.bigint);
			if (nearDup) {
				fs.unlink(tmp, () => {});
				dupNear++;
				if ((i + 1) % 50 === 0 || i === total - 1) {
					console.log(`${statusLine} ⏭ near dup of ${nearDup.id} (skipped)`);
				}
				continue;
			}

			// Insert into DB — get back the record with its UUID
			const record = await prisma.reactionGif.create({
				data: {
					hash: shaHash,
					actions: ourActions,
					fileType: ext,
					mediaHash: phash.bigint,
				},
			});

			// Save to storage using the DB record's UUID as filename
			const destPath = path.join(GIF_DIR, `${record.id}.${ext}`);
			fs.copyFileSync(tmp, destPath);
			fs.unlink(tmp, () => {});
			existingHashSet.add(shaHash);
			imported++;

			if ((i + 1) % 50 === 0 || i === total - 1) {
				console.log(`${statusLine} ✅ ${ourActions[0]} (${gif.action}) — ${formatBytes(gif.size_bytes)}`);
			}
		} catch (err) {
			errors++;
			console.error(`${statusLine} ❌ ${gif.action}#${gif.id}: ${err.message}`);
		}
	}

	const duration = formatDuration(Date.now() - startTime);
	console.log("\n=== Import Complete ===");
	console.log(`  Total:      ${total}`);
	console.log(`  Imported:   ${imported}`);
	console.log(`  Skipped:    ${skipped}`);
	console.log(`  Exact dups: ${dupExact}`);
	console.log(`  Near dups:  ${dupNear}`);
	console.log(`  Errors:     ${errors}`);
	console.log(`  Duration:   ${duration}`);

	await prisma.$disconnect();
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
