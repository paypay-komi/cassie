const { PermissionsBitField } = require("discord.js");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const os = require("os");
const axios = require("axios");
const { spawn } = require("child_process");

const db = require("../../../db");
const config = require("../../../config.json");
const {
	hashImage,
	findNearDuplicate,
} = require("../../../utils/perceptualHash");
const { ALL_ACTIONS } = require("../../../utils/actionGroups");

const VALID_ACTIONS = ALL_ACTIONS;

/* =========================================================
   UX
   ========================================================= */

function progressBar(pct) {
	const filled = Math.round(pct / 10);
	const empty = 10 - filled;
	return "[" + "█".repeat(filled) + "░".repeat(empty) + `] ${pct}%`;
}

/* =========================================================
   EMBED RESOLVER (Discord-style)
   ========================================================= */

function extractFromDiscordMessage(message) {
	if (message.attachments?.size) {
		return message.attachments.first().url;
	}

	if (message.embeds?.length) {
		const e = message.embeds[0];
		if (e.video?.url) return e.video.url;
		if (e.image?.url) return e.image.url;
		if (e.thumbnail?.url) return e.thumbnail.url;
		if (e.url) return e.url;
	}

	return null;
}

async function fetchHTML(url) {
	try {
		const res = await axios.get(url, {
			timeout: 20000,
			maxRedirects: 5,
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122",
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				Referer: url,
			},
		});
		return res.data;
	} catch {
		return null;
	}
}

function extractMediaUrl(html) {
	if (!html) return null;

	let m =
		html.match(/property="og:video:secure_url" content="([^"]+)"/i) ||
		html.match(/property="og:video:url" content="([^"]+)"/i) ||
		html.match(/property="og:video" content="([^"]+)"/i);

	if (m?.[1]) return m[1];

	m = html.match(/property="og:image" content="([^"]+)"/i);
	if (m?.[1]) return m[1];

	m = html.match(/"contentUrl"\s*:\s*"(https?:\/\/[^"]+\.(gif|mp4|webm)[^"]*)"/i);
	if (m?.[1]) return m[1];

	m = html.match(/https?:\/\/[^\s"'<>]+\.(gif|mp4|webm)/i);
	if (m?.[0]) return m[0];

	return null;
}

async function resolveMedia(url) {
	if (!url) return null;
	if (/\.(gif|mp4|webm)(\?|$)/i.test(url)) return url;

	const html = await fetchHTML(url);
	return extractMediaUrl(html) || url;
}

/* =========================================================
   FFmpeg CONVERSION
   ========================================================= */

function convertToGif(input, output) {
	return new Promise((resolve, reject) => {
		const ff = spawn("ffmpeg", [
			"-y",
			"-i",
			input,
			"-vf",
			"fps=15,scale=512:-1:flags=lanczos",
			"-loop",
			"0",
			output,
		]);

		ff.on("error", reject);

		ff.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error("ffmpeg failed: " + code));
		});
	});
}

/* =========================================================
   MAIN
   ========================================================= */

module.exports = {
	commandId: "ebc2cdfe-f6d3-4011-9839-7628217d9bde",
	name: "submit",
	parent: "action",
	aliases: ["add"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],

	async execute(message, args) {
		let sourceUrl = extractFromDiscordMessage(message);
		const actionArgs = [];

		for (const a of args) {
			if (/^https?:\/\//i.test(a)) {
				if (!sourceUrl) sourceUrl = a;
				continue;
			}
			actionArgs.push(a);
		}

		if (!sourceUrl) {
			return message.reply("attach a file or URL");
		}

		sourceUrl = await resolveMedia(sourceUrl);

		const raw = actionArgs
			.map((a) => a.toLowerCase().trim())
			.filter((a) => !a.includes("://"));

		const valid = raw.filter((a) => VALID_ACTIONS.includes(a));
		const invalid = raw.filter((a) => !VALID_ACTIONS.includes(a));

		if (invalid.length) {
			return message.reply(
				`unknown action tags:\n` +
					invalid.map((a) => `\`${a}\``).join("\n"),
			);
		}

		if (!valid.length) {
			return message.reply("missing action tags");
		}

		/* =====================================================
		   DOWNLOAD
		   ===================================================== */

		const tmp = path.join(os.tmpdir(), `gif_${Date.now()}`);
		const converted = tmp + "_converted.gif";

		const msg = await message.reply(`⬇️ Downloading… ${progressBar(0)}`);

		try {
			const res = await axios({
				method: "get",
				url: sourceUrl,
				responseType: "stream",
				timeout: 30000,
				headers: {
					"User-Agent": "Mozilla/5.0",
					Referer: new URL(sourceUrl).origin,
				},
			});

			const writer = fs.createWriteStream(tmp);

			await new Promise((resolve, reject) => {
				res.data.pipe(writer);
				writer.on("finish", resolve);
				writer.on("error", reject);
			});

			await msg.edit(
				`⬇️ Downloaded ${progressBar(90)}\n🎞️ Converting…`,
			);

			/* =====================================================
			   FFmpeg CONVERT (FIX FOR SHARP ERROR)
			   ===================================================== */

			await convertToGif(tmp, converted);

			await msg.edit(
				`⬇️ Downloaded ${progressBar(90)}\n🎞️ Converted ${progressBar(90)}\n🔍 Hashing…`,
			);

			/* =====================================================
			   HASH (ONLY SAFE GIF NOW)
			   ===================================================== */

			const hash = await new Promise((res, rej) => {
				const h = crypto.createHash("sha256");
				fs.createReadStream(converted)
					.on("data", (d) => h.update(d))
					.on("end", () => res(h.digest("hex")))
					.on("error", rej);
			});

			const existing =
				(await db.prisma.reactionGif.findUnique({
					where: { hash },
					select: { id: true },
				})) ||
				(await db.prisma.submittedReactonGif.findUnique({
					where: { hash },
					select: { id: true },
				}));

			if (existing) {
				return msg.edit("⚠️ duplicate found");
			}

			const phash = await hashImage(converted);

			const nearDup = await findNearDuplicate(db.prisma, phash);
			if (nearDup) {
				return msg.edit("⚠️ near duplicate found");
			}

			/* =====================================================
			   DB INSERT
			   ===================================================== */

			const record = config.owners.includes(message.author.id)
				? await db.prisma.reactionGif.create({
						data: {
							hash,
							actions: valid,
							fileType: "gif",
							mediaHash: phash.bigint,
						},
				  })
				: await db.prisma.submittedReactonGif.create({
						data: {
							hash,
							actions: valid,
							fileType: "gif",
							mediaHash: phash.bigint,
							submittedBy: message.author.id,
						},
				  });

			fs.mkdirSync("L:\\reactiongifs", { recursive: true });

			fs.copyFileSync(
				converted,
				path.join("L:\\reactiongifs", `${record.id}.gif`),
			);

			await msg.edit(
				`⬇️ Downloaded ${progressBar(90)}\n🎞️ Converted ${progressBar(90)}\n🔍 Hashed ${progressBar(90)}\n✅ Done`,
			);
		} catch (err) {
			console.error(err);
			await msg.edit("❌ failed processing file");
		} finally {
			fs.unlink(tmp, () => {});
			fs.unlink(converted, () => {});
		}
	},
};
