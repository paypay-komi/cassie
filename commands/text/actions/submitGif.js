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
];

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
		const attachment = message.attachments?.first();
		if (!attachment) {
			return message.reply("please attach a GIF or MP4");
		}

		const ext = path
			.extname(attachment.name || attachment.url)
			.toLowerCase();
		if (![".gif", ".mp4", ".webm"].includes(ext)) {
			return message.reply("only GIF, MP4, or WebM files are supported");
		}
		const fileType = ext.slice(1);

		// Parse action tags from args
		const actions = args.length
			? args
					.filter((a) => VALID_ACTIONS.includes(a.toLowerCase()))
					.map((a) => a.toLowerCase())
			: ["hug"];
		if (!actions.length) {
			return message.reply(
				`no valid actions found. Valid: ${VALID_ACTIONS.join(", ")}`,
			);
		}

		const tmp = path.join(
			os.tmpdir(),
			`sub_gif_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`,
		);

		try {
			// Download attachment
			const res = await axios({
				method: "get",
				url: attachment.url,
				responseType: "stream",
				timeout: 30000,
			});
			const writer = fs.createWriteStream(tmp);
			await new Promise((res, rej) => {
				writer.on("finish", res);
				writer.on("error", rej);
				res.data.pipe(writer);
			});

			// Compute exact hash (SHA256) for the `hash` field
			const exactHash = await new Promise((res, rej) => {
				const h = crypto.createHash("sha256");
				fs.createReadStream(tmp)
					.on("data", (d) => h.update(d))
					.on("end", () => res(h.digest("hex")))
					.on("error", rej);
			});

			// Check for exact duplicate (unique constraint catches it too, but gives a nicer message)
			const existing = await db.prisma.reactionGif.findUnique({
				where: { hash: exactHash },
				select: { id: true },
			});
			if (existing) {
				return message.reply(
					"that exact file is already in the collection",
				);
			}

			// Compute perceptual hash and check for near-duplicates
			const phash = await hashMedia(tmp);

			// Check both tables for near-duplicate
			const nearDup = await findNearDuplicate(db.prisma, phash);
			if (nearDup) {
				return message.reply(
					`that's a near-duplicate of \`${nearDup}\``,
				);
			}

			if (config.owners.includes(message.author.id)) {
				// Owner — insert directly to ReactionGif, skip pending
				await db.prisma.reactionGif.create({
					data: {
						hash: exactHash,
						actions,
						fileType,
						mediaHash: phash.bigint,
					},
				});
				return message.reply(
					`added \`${exactHash.slice(0, 12)}…\` for actions: ${actions.join(", ")}`,
				);
			}

			// Non-owner — submit for review
			await db.prisma.submittedReactonGif.create({
				data: {
					hash: exactHash,
					actions,
					fileType,
					mediaHash: phash.bigint,
					submittedBy: message.author.id,
				},
			});
			return message.reply(
				"submitted for review! an owner will approve it soon.",
			);
		} catch (err) {
			console.error(err);
			return message.reply("something went wrong processing that file");
		} finally {
			fs.unlink(tmp, () => {});
		}
	},
};
