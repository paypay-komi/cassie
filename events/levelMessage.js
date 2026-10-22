const { Events } = require("discord.js");
const levels = require("../lib/levels");
const { getLogger } = require("../lib/logger");

const log = getLogger("Levels");

const cooldowns = new Map();

module.exports = {
	name: Events.MessageCreate,
	async execute(client, message) {
		if (!message.guild || message.author.bot) return;

		const prisma = client.db.prisma;

		let config;
		try {
			config = await levels.getConfig(prisma, message.guild.id);
		} catch (err) {
			log.warn(`Config load failed: ${err.message}`);
			return;
		}
		if (!config.enabled) return;
		if (!config.textEnabled) return;

		const member =
			message.member ||
			(await message.guild.members
				.fetch(message.author.id)
				.catch(() => null));
		if (!member) return;

		try {
			if (
				await levels.isIgnored(
					prisma,
					message.guild.id,
					member,
					message.channelId,
				)
			)
				return;
		} catch {
			/* ignore */
		}

		const key = `${message.guild.id}:${message.author.id}`;
		const last = cooldowns.get(key) || 0;
		if (Date.now() - last < levels.COOLDOWN_MS) return;
		cooldowns.set(key, Date.now());

		let mult = 1;
		try {
			mult = await levels.multiplierFor(
				prisma,
				message.guild.id,
				member,
				message.channelId,
			);
		} catch {
			/* ignore */
		}

		const base =
			Math.floor(Math.random() * (levels.XP_MAX - levels.XP_MIN + 1)) +
			levels.XP_MIN;
		const gain = Math.max(
			1,
			Math.round(base * (config.textMultiplier || 1) * mult),
		);

		let res;
		try {
			res = await levels.addXp(
				prisma,
				message.guild.id,
				message.author.id,
				gain,
			);
		} catch (err) {
			log.warn(`addXp failed: ${err.message}`);
			return;
		}

		if (res?.leveledUp) {
			await levels.handleLevelUp(
				client,
				message.guild,
				member,
				config,
				res.after.level,
			);
		}
	},
};
