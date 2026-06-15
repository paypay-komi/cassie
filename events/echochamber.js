const { Events, Client, Message, PermissionsBitField } = require("discord.js");
const { getLogger } = require("../lib/logger");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const parseTime = require("../utils/parseTime");
const db = require("../db");
const echoChamberHandler = require("../startuptasks/data/handleEchoChamber");

const log = getLogger("echoChamber");
const recentMessages = new Set();
setInterval(() => recentMessages.clear(), 10000);

// --- Defaults (used when channel doesn't have a value set) ---
const DEFAULT_ECHO_CHANCE = 85;
const DEFAULT_DELETE_DELAY_MIN = parseTime("10s");
const DEFAULT_DELETE_DELAY_MAX = parseTime("1m");
const DEFAULT_ECHO_DELAY_MIN = parseTime("0s");
const DEFAULT_ECHO_DELAY_MAX = parseTime("2h");

module.exports = {
	name: Events.MessageCreate,
	description: "Echo messages in echo chambers — deletes original, queues with random delay",

	/**
	 * @param {Client} client
	 * @param {Message} message
	 */
	async execute(client, message) {
		if (message.webhookId) return;
		const channel = await db.prisma.echoChannel.findFirst({
			where: { channelId: message.channelId },
		});
		if (!channel) return;
		const msgContent = message.content;
		const msgId = message.id;

		// Dedup: Discord can fire messageCreate twice for the same message
		if (recentMessages.has(msgId)) {
			log.warn(`🔁 duplicate messageCreate ${msgId}, dropping`);
			return;
		}
		recentMessages.add(msgId);
		log.info(`📩 messageCreate ${msgId} | author=${message.author.username} | "${msgContent.slice(0, 60)}"`);

		// Read config from DB, fall back to defaults
		const echoChance = (channel.echoChance ?? DEFAULT_ECHO_CHANCE) / 100;
		const deleteDelayMin = channel.deleteDelayMin ?? DEFAULT_DELETE_DELAY_MIN;
		const deleteDelayMax = channel.deleteDelayMax ?? DEFAULT_DELETE_DELAY_MAX;
		const echoDelayMin = channel.echoDelayMin ?? DEFAULT_ECHO_DELAY_MIN;
		const echoDelayMax = channel.echoDelayMax ?? DEFAULT_ECHO_DELAY_MAX;

		// Download attachments before anything
		let attachments = [];
		if (message.attachments.size) {
			const dir = path.join("L:\\echo-attachments", msgId);
			fs.mkdirSync(dir, { recursive: true });
			let idx = 0;
			for (const [, att] of message.attachments) {
				try {
					const res = await axios.get(att.url, {
						responseType: "arraybuffer",
					});
					const filePath = path.join(dir, `${idx}-${att.name}`);
					fs.writeFileSync(filePath, Buffer.from(res.data));
					attachments.push({ path: filePath, filename: att.name });
					idx++;
				} catch (err) {
					log.warn(`failed to download ${att.url}: ${err.message}`);
				}
			}
		}

		// Capture poll and embeds before anything
		let pollData, embedData;
		if (message.poll) {
			pollData = {
				question: { text: message.poll.question.text },
				answers: message.poll.answers.map((a) => ({
					text: a.text,
					emoji: a.emoji ? { name: a.emoji.name, id: a.emoji.id } : null,
				})),
				allowMultiselect: message.poll.allowMultiselect,
				duration: message.poll.duration,
				layoutType: message.poll.layoutType,
			};
		}
		if (message.embeds.length) {
			embedData = message.embeds.map((e) => e.data);
		}

		// Check for mass mentions — strip before anything else
		let storedContent = msgContent;
		const hasEveryonePerm = message.member?.permissions.has(PermissionsBitField.Flags.MentionEveryone);
		let stripped = false;

		if (message.mentions.everyone && !hasEveryonePerm) {
			storedContent = storedContent.replace(/@everyone/g, '(@\u200Beveryone mention nice try)');
			storedContent = storedContent.replace(/@here/g, '(@\u200Bhere mention nice try)');
			stripped = true;
		}

		if (msgContent.includes('<@&')) {
			const roleMatches = [...msgContent.matchAll(/<@&(\d+)>/g)];
			const roleNames = new Map();
			for (const [, id] of roleMatches) {
				if (!hasEveryonePerm) {
					try {
						const role = await message.guild?.roles.fetch(id);
						if (role && !role.mentionable) {
							roleNames.set(id, role.name);
						}
					} catch { /* role deleted or can't fetch */ }
				}
			}
			if (roleNames.size) {
				storedContent = storedContent.replace(/<@&(\d+)>/g, (_, id) => {
					return roleNames.has(id) ? `(@${roleNames.get(id)} role mention nice try)` : `<@&${id}>`;
				});
				stripped = true;
			}
		}

		if (stripped) {
			try {
				await message.reply(`<@${message.author.id}> nice try`);
			} catch { /* non-fatal */ }
		}

		// Roll: does it echo at all?
		if (Math.random() > echoChance) {
			log.info(`✖ not chosen | ${message.author.username}: "${msgContent.slice(0, 80)}"`);
			if (attachments.length) {
				fs.rmSync(path.dirname(attachments[0].path), { recursive: true, force: true });
			}
			return;
		}

		// Wait delete delay, then delete and queue
		const deleteDelay = deleteDelayMin + Math.random() * (deleteDelayMax - deleteDelayMin);
		log.info(`✔ chosen | ${message.author.username} | delete in ${Math.round(deleteDelay / 1000)}s | "${msgContent.slice(0, 80)}"`);

		setTimeout(async () => {
			try {
				await message.delete();
			} catch {
				log.warn(`✖ already deleted | ${message.author.username}: "${msgContent.slice(0, 80)}"`);
				if (attachments.length) {
					fs.rmSync(path.dirname(attachments[0].path), { recursive: true, force: true });
				}
				return;
			}

			const echoDelay = echoDelayMin + Math.random() * (echoDelayMax - echoDelayMin);
			log.info(`🗑 deleted | ${message.author.username} | echoing in ${Math.round(echoDelay / 1000)}s | "${msgContent.slice(0, 80)}"`);

			await db.prisma.echoMessage.create({
				data: {
					channelId: message.channel.id,
					guildId: message.guild.id,
					authorId: message.author.id,
					content: storedContent,
					deliverAt: new Date(Date.now() + echoDelay),
					originalMessageId: message.reference?.messageId || null,
					attachments: attachments.length ? attachments : undefined,
					poll: pollData || undefined,
					embeds: embedData || undefined,
				},
			});
			try {
				echoChamberHandler.recheck(client);
			} catch {
				/* non-fatal */
			}
		}, deleteDelay);
	},
};
