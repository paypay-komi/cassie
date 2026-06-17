const { PermissionsBitField } = require("discord.js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const db = require("../../../db");
const config = require("../../../config.json");
const {
	hashImage,
	findNearDuplicate,
} = require("../../../utils/perceptualHash");

const VALID_ACTIONS = [
	"hug",
	"pat",
	"kiss",
	"cuddle",
	"boop",
	"bite",
	"lick",
	"nom",
	"pounce",
	"kill",
	"slap",
	"spank",
	"bonk",
	"stab",
	"shoot",
	"punch",
	"kick",
	"choke",
	"drown",
	"burn",
	"freeze",
	"explode",
	"crush",
	"headpat",
	"headrub",
	"backrub",
	"footrub",
	"massage",
	"handhold",
	"snuggle",
	"nuzzle",
	"kisscheek",
	"bless",
	"wave",
	"highfive",
	"fistbump",
	"handshake",
	"dance",
	"spin",
	"twirl",
	"dip",
	"lift",
	"carry",
	"piggyback",
	"stare",
	"glare",
	"wink",
	"smirk",
	"blush",
	"sweat",
	"facepalm",
	"laugh",
	"smile",
	"grin",
	"cheer",
	"celebrate",
	"happy",
	"excited",
	"cry",
	"sob",
	"scream",
	"calm",
	"relaxed",
	"sleep",
	"yawn",
	"poke",
	"nudge",
	"tap",
	"squish",
	"pinch",
	"tickle",
	"point",
	"beckon",
	"shoo",
	"shush",
	"glomp",
	"tackle",
	"ambush",
	"hide",
	"peek",
	"creep",
	"sneak",
	"bow",
	"curtsy",
	"kneel",
	"propose",
	"beg",
	"salute",
	"flip",
	"backflip",
	"cartwheel",
	"somersault",
	"juggle",
	"balance",
	"magic",
	"levitate",
	"tpose",
	"crab",
	"shuffle",
	"moonwalk",
	"tea",
	"coffee",
	"cook",
	"bake",
	"feed",
	"pet",
	"walk",
	"brush",
	"wash",
	"dry",
	"blowkiss",
];

/**
 * Levenshtein edit distance between two strings
 */
function levenshtein(a, b) {
	const dp = Array(b.length + 1)
		.fill()
		.map(() => Array(a.length + 1).fill(0));
	for (let i = 0; i <= b.length; i++) dp[i][0] = i;
	for (let j = 0; j <= a.length; j++) dp[0][j] = j;
	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b[i - 1] === a[j - 1]) dp[i][j] = dp[i - 1][j - 1];
			else
				dp[i][j] =
					1 + Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]);
		}
	}
	return dp[b.length][a.length];
}

/**
 * Find up to `count` closest matches from candidates
 */
function suggestActions(input, candidates, count = 3) {
	const scored = candidates
		.map((c) => ({
			candidate: c,
			dist: levenshtein(input.toLowerCase(), c.toLowerCase()),
		}))
		.sort((a, b) => a.dist - b.dist)
		.slice(0, count);
	return scored;
}

/**
 * Sniff the first few bytes of a file to confirm it's actually a GIF.
 * Tenor and similar sites serve MP4s disguised with .gif URLs.
 * Returns the real file type ("gif", "mp4", "webm") or null if unrecognized.
 */
function sniffRealType(filePath) {
	const fd = fs.openSync(filePath, "r");
	const buf = Buffer.alloc(12);
	fs.readSync(fd, buf, 0, 12, 0);
	fs.closeSync(fd);

	const header = buf.toString("ascii", 0, 6);
	if (header === "GIF87a" || header === "GIF89a") return "gif";

	const ftyp = buf.toString("ascii", 4, 8);
	if (ftyp === "ftyp") return "mp4";

	// WebM / Matroska EBML header
	if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "webm";

	return null;
}

function progressBar(pct) {
	const filled = Math.round(pct / 10);
	const empty = 10 - filled;
	return "[" + "\u2588".repeat(filled) + "\u2591".repeat(empty) + `] ${pct}%`;
}

const BASE = (
	process.env.BASE_URL || "https://nekomi.tailef6033.ts.net"
).replace(/\/+$/, "");

const GIF_DIR = "L:\\reactiongifs";

module.exports = {
	commandId: "ebc2cdfe-f6d3-4011-9839-7628217d9bde",
	name: "submit",
	description:
		"submits a gif for review — owners bypass pending, tags optional",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	parent: "action",
	aliases: ["add"],
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		// Pull source URL from args or attachment
		let sourceUrl = null;
		const actionArgs = [];
		for (const a of args) {
			if (!sourceUrl && /^https?:\/\//i.test(a)) {
				sourceUrl = a;
			} else {
				actionArgs.push(a);
			}
		}

		if (!sourceUrl) {
			const att = message.attachments?.first();
			if (att) sourceUrl = att.url;
		}

		if (!sourceUrl) {
			return message.reply(
				"attach a file or pass a URL: `c.submit <url> <action>…`",
			);
		}

		// Tenor URLs need .gif appended — they serve MP4s otherwise
		if (/tenor\.com/i.test(sourceUrl) && !path.extname(sourceUrl.split("?")[0])) {
			sourceUrl = sourceUrl.replace(/\/?(\?.*)?$/, ".gif$1");
		}

		const ext =
			path.extname(sourceUrl.split("?")[0].split("#")[0]).toLowerCase() ||
			".gif";
		if (![".gif"].includes(ext)) {
			return message.reply("only GIF files are supported");
		}
		const fileType = ext.slice(1);

		const raw = actionArgs.map((a) => a.toLowerCase());
		const valid = raw.filter((a) => VALID_ACTIONS.includes(a));
		const invalid = raw.filter((a) => !VALID_ACTIONS.includes(a));

		if (invalid.length) {
			const lines = invalid.map((a) => {
				const suggestions = suggestActions(a, VALID_ACTIONS);
				return `\`${a}\` → ${suggestions.map((s) => `\`${s.candidate}\`?`).join(", ")}`;
			});
			return message.reply(`unknown action tags:\n${lines.join("\n")}`);
		}

		if (!valid.length) {
			return message.reply(
				`specify at least one action tag.\nValid: ${VALID_ACTIONS.join(", ")}`,
			);
		}

		/** @type {string[]} */
		const actions = valid;

		const tmp = path.join(
			os.tmpdir(),
			`sub_gif_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`,
		);

		const msg = await message.reply(`⬇️ Downloading… ${progressBar(0)}`);

		try {
			// ── download with live progress ──
			const axiosRes = await axios({
				method: "get",
				url: sourceUrl,
				responseType: "stream",
				timeout: 30000,
			});
			const total = parseInt(axiosRes.headers["content-length"], 10);
			const writer = fs.createWriteStream(tmp);
			let received = 0;
			axiosRes.data.on("data", (chunk) => {
				received += chunk.length;
				if (total) {
					const pct = Math.min(
						Math.round((received / total) * 90),
						90,
					);
					msg.edit(`⬇️ Downloading… ${progressBar(pct)}`).catch(
						() => {},
					);
				}
			});
			await new Promise((resolve, reject) => {
				writer.on("finish", resolve);
				writer.on("error", reject);
				axiosRes.data.pipe(writer);
			});
			await msg.edit(
				`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashing…        ${progressBar(90)}`,
			);

			// ── verify actual file type via magic bytes ──
			const realType = sniffRealType(tmp);
			if (!realType) {
				return msg.edit("⚠️ unrecognized file format — only GIF is supported");
			}
			if (realType !== "gif") {
				return msg.edit(
					`⚠️ URL points to a ${realType.toUpperCase()} file, not a GIF — Tenor etc. serve MP4s as .gif URLs`,
				);
			}

			// ── exact hash ──
			const exactHash = await new Promise((res, rej) => {
				const h = crypto.createHash("sha256");
				fs.createReadStream(tmp)
					.on("data", (d) => h.update(d))
					.on("end", () => res(h.digest("hex")))
					.on("error", rej);
			});
			await msg.edit(
				`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checking dupes… ${progressBar(90)}`,
			);

			// ── exact duplicate check (both tables) ──
			const existing = await db.prisma.reactionGif.findUnique({
				where: { hash: exactHash },
				select: { id: true },
			});
			const existingSubmitted = existing
				? null
				: await db.prisma.submittedReactonGif.findUnique({
						where: { hash: exactHash },
						select: { id: true },
					});
			const dup = existing || existingSubmitted;
			if (dup) {
				return msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n⚠️  Exact duplicate: ${BASE}/reactiongifs/${dup.id}`,
				);
			}

			// ── perceptual hash + near-duplicate check ──
			const phash = await hashImage(tmp);

			const nearDup = await findNearDuplicate(db.prisma, phash);
			if (nearDup) {
				return msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n⚠️  Near-duplicate: ${BASE}/reactiongifs/${nearDup.id}`,
				);
			}

			// ── insert ──
			let record;
			if (config.owners.includes(message.author.id)) {
				record = await db.prisma.reactionGif.create({
					data: {
						hash: exactHash,
						actions,
						fileType,
						mediaHash: phash.bigint,
					},
				});
			} else {
				record = await db.prisma.submittedReactonGif.create({
					data: {
						hash: exactHash,
						actions,
						fileType,
						mediaHash: phash.bigint,
						submittedBy: message.author.id,
					},
				});
			}

			// ── save to L drive ──
			fs.mkdirSync(GIF_DIR, { recursive: true });
			fs.copyFileSync(
				tmp,
				path.join(GIF_DIR, `${record.id}.${record.fileType}`),
			);

			if (config.owners.includes(message.author.id)) {
				await msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n✅ Added!          ${progressBar(100)}`,
				);
			} else {
				await msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n✅ Submitted for review! ${progressBar(100)}`,
				);
			}
		} catch (err) {
			console.error(err);
			await msg
				.edit("❌ something went wrong processing that file")
				.catch(() => {});
		} finally {
			fs.unlink(tmp, () => {});
		}
	},
};
