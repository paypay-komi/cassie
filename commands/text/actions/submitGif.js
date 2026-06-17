const { PermissionsBitField } = require("discord.js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const db = require("../../../db");
const config = require("../../../config.json");
const {
	hashMedia,
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
	"strangle",
	"drown",
	"burn",
	"freeze",
	"explode",
	"crush",
	"headpat",
	"headrub",
	"earscratch",
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
	"brofist",
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
	"panik",
	"calm",
	"relaxed",
	"sleep",
	"yawn",
	"poke",
	"prod",
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
	"orangejustice",
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

function progressBar(pct) {
	const filled = Math.round(pct / 10);
	const empty = 10 - filled;
	return "[" + "\u2588".repeat(filled) + "\u2591".repeat(empty) + `] ${pct}%`;
}

const BASE = (
	process.env.BASE_URL || "https://nekomi.tailef6033.ts.net"
).replace(/\/+$/, "");

module.exports = {
	name: "submit",
	description:
		"submits a gif for review — owners bypass pending, tags optional",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
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

		const ext =
			path.extname(sourceUrl.split("?")[0].split("#")[0]).toLowerCase() ||
			".gif";
		if (![".gif", ".mp4", ".webm"].includes(ext)) {
			return message.reply("only GIF, MP4, or WebM files are supported");
		}
		const fileType = ext.slice(1);

		const actions = actionArgs
			.filter((a) => VALID_ACTIONS.includes(a.toLowerCase()))
			.map((a) => a.toLowerCase());
		if (!actions.length) {
			return message.reply(
				`specify at least one action tag. Valid: ${VALID_ACTIONS.join(", ")}`,
			);
		}

		const tmp = path.join(
			os.tmpdir(),
			`sub_gif_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`,
		);

		const msg = await message.reply(`⬇️ Downloading… ${progressBar(0)}`);

		try {
			// ── download with live progress ──
			const res = await axios({
				method: "get",
				url: sourceUrl,
				responseType: "stream",
				timeout: 30000,
			});
			const total = parseInt(res.headers["content-length"], 10);
			const writer = fs.createWriteStream(tmp);
			let received = 0;
			res.data.on("data", (chunk) => {
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
			await new Promise((res, rej) => {
				writer.on("finish", res);
				writer.on("error", rej);
				res.data.pipe(writer);
			});
			await msg.edit(
				`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashing…        ${progressBar(90)}`,
			);

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

			// ── exact duplicate check ──
			const existing = await db.prisma.reactionGif.findUnique({
				where: { hash: exactHash },
				select: { hash: true },
			});
			if (existing) {
				return msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n⚠️  Exact duplicate: ${BASE}/reactiongifs/${existing.hash}`,
				);
			}

			// ── perceptual hash + near-duplicate check ──
			const phash = await hashMedia(tmp);

			const nearDupHash = await findNearDuplicate(db.prisma, phash);
			if (nearDupHash) {
				return msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n⚠️  Near-duplicate: ${BASE}/reactiongifs/${nearDupHash}`,
				);
			}

			// ── insert ──
			if (config.owners.includes(message.author.id)) {
				await db.prisma.reactionGif.create({
					data: {
						hash: exactHash,
						actions,
						fileType,
						mediaHash: phash.bigint,
					},
				});
				await msg.edit(
					`⬇️ Downloaded      ${progressBar(90)}\n🔍 Hashed          ${progressBar(90)}\n📦 Checked         ${progressBar(90)}\n✅ Added!          ${progressBar(100)}`,
				);
			} else {
				await db.prisma.submittedReactonGif.create({
					data: {
						hash: exactHash,
						actions,
						fileType,
						mediaHash: phash.bigint,
						submittedBy: message.author.id,
					},
				});
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
