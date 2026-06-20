/**
 * Import anime reaction GIFs from nekos.best API (free, no key).
 * Maps endpoints to our missing action tags.
 * Usage: node scripts/importNekos.js
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

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const GIF_DIR = "L:\\reactiongifs";
const API_BASE = "https://nekos.best/api/v2";
const AMOUNT = 50;
const MAX_SIGNED_64 = 1n << 63n;

// nekos.best endpoints → our action tag(s)
const ENDPOINT_MAP = {
  shoot: ["shoot"],
  lurk: ["hide", "creep", "sneak"],
  yeet: ["yeet"],
  bite: ["bite"],
  shocked: ["shock", "gasp"],
  bored: ["bored", "uninterested"],
  yawn: ["yawn"],
  spin: ["spin"],
  handshake: ["handshake"],
  handhold: ["handhold"],
  salute: ["salute"],
  confused: ["confused"],
};

function toSigned64(val) {
	if (val >= MAX_SIGNED_64) return val - (MAX_SIGNED_64 << 1n);
	return val;
}

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

async function hashImage(filePath) {
	const buf = await gifToPngBuffer(filePath);
	const input = buf || filePath;
	const { data } = await sharp(input).resize(8, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
	let sum = 0;
	for (let i = 0; i < 64; i++) sum += data[i];
	const avg = sum / 64;
	let bits = 0n;
	for (let i = 0; i < 64; i++) if (data[i] > avg) bits |= 1n << BigInt(i);
	return { hex: bits.toString(16).padStart(16, "0"), bigint: toSigned64(bits) };
}

async function findNearDuplicate(phashBigint, threshold = 10) {
	const rows = await prisma.$queryRaw`
		SELECT id, hash, BIT_COUNT(("mediaHash" # ${phashBigint})::bit(64)) AS distance
		FROM (SELECT id, hash, "mediaHash" FROM "ReactionGif" WHERE "mediaHash" IS NOT NULL
			UNION ALL
			SELECT id, hash, "mediaHash" FROM "SubmittedReactonGif" WHERE "mediaHash" IS NOT NULL) combined
		WHERE BIT_COUNT(("mediaHash" # ${phashBigint})::bit(64)) <= ${threshold}
		ORDER BY distance LIMIT 1`;
	return rows?.[0] ? { id: rows[0].id, hash: rows[0].hash } : null;
}

async function download(url, dest) {
	const writer = fs.createWriteStream(dest);
	const response = await axios({ method: "get", url, responseType: "stream", timeout: 30000 });
	await new Promise((resolve, reject) => {
		writer.on("finish", resolve);
		writer.on("error", reject);
		response.data.pipe(writer);
	});
}

async function main() {
	fs.mkdirSync(GIF_DIR, { recursive: true });
	console.log("=== nekos.best Import ===\n");
	console.log(`Endpoints: ${Object.keys(ENDPOINT_MAP).length}\n`);

	// Pre-collect existing hashes
	const existing = await prisma.reactionGif.findMany({ select: { hash: true } });
	const existingSubmitted = await prisma.submittedReactonGif.findMany({ select: { hash: true } });
	const dupSet = new Set([...existing.map(r => r.hash), ...existingSubmitted.map(r => r.hash)]);

	let total = 0, errors = 0;
	for (const [endpoint, actions] of Object.entries(ENDPOINT_MAP)) {
		let endpointTotal = 0, endpointErrors = 0;
		try {
			const { data } = await axios.get(`${API_BASE}/${endpoint}?amount=${AMOUNT}`, { timeout: 10000 });
			if (!data.results?.length) {
				console.log(`[${endpoint.padEnd(12)}] 0 results`);
				continue;
			}
			for (const result of data.results) {
				const tmp = path.join(os.tmpdir(), `nekos_${endpoint}_${Date.now()}_${Math.random().toString(36).slice(2)}.gif`);
				try {
					await download(result.url, tmp);
					const shaHash = await new Promise((res, rej) => {
						const h = crypto.createHash("sha256");
						fs.createReadStream(tmp).on("data", d => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej);
					});
					if (dupSet.has(shaHash)) { fs.unlink(tmp, () => {}); continue; }

					const phash = await hashImage(tmp);
					const near = await findNearDuplicate(phash.bigint);
					if (near) { fs.unlink(tmp, () => {}); continue; }

					const record = await prisma.reactionGif.create({
						data: { hash: shaHash, actions, fileType: "gif", mediaHash: phash.bigint },
					});
					fs.copyFileSync(tmp, path.join(GIF_DIR, `${record.id}.gif`));
					fs.unlink(tmp, () => {});
					dupSet.add(shaHash);
					endpointTotal++;
				} catch (err) {
					endpointErrors++;
					try { fs.unlink(tmp, () => {}); } catch {}
				}
			}
		} catch (err) {
			console.log(`[${endpoint.padEnd(12)}] API error: ${err.message}`);
			continue;
		}
		total += endpointTotal;
		errors += endpointErrors;
		console.log(`[${endpoint.padEnd(12)}] +${endpointTotal} err:${endpointErrors}`);
	}

	const count = await prisma.reactionGif.count();
	console.log(`\n=== Done === +${total} new (${errors} errors) | Total: ${count}`);
	await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
