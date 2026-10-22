const { Events } = require("discord.js");
const levels = require("../lib/levels");
const { getLogger } = require("../lib/logger");

const log = getLogger("Levels");

// `${guildId}:${userId}` -> session start timestamp
const sessions = new Map();

const VOICE_XP_PER_MIN = 5;

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(client, oldState, newState) {
		const guild = newState.guild || oldState.guild;
		if (!guild) return;

		const member = newState.member || oldState.member;
		if (!member || member.user.bot) return;

		const key = `${guild.id}:${member.id}`;
		const wasIn = oldState.channelId;
		const nowIn = newState.channelId;

		// Joined voice — start a session
		if (!wasIn && nowIn) {
			sessions.set(key, Date.now());
			return;
		}

		// Left voice — finalize and award
		if (wasIn && !nowIn) {
			const start = sessions.get(key);
			sessions.delete(key);
			if (!start) return;

			const seconds = Math.floor((Date.now() - start) / 1000);
			if (seconds < 60) return;

			const prisma = client.db.prisma;

			let config;
			try {
				config = await levels.getConfig(prisma, guild.id);
			} catch {
				return;
			}
			if (!config.enabled) return;
			if (!config.voiceEnabled) return;

			try {
				if (
					await levels.isIgnored(
						prisma,
						guild.id,
						member,
						wasIn,
					)
				)
					return;
			} catch {
				/* ignore */
			}

			let mult = 1;
			try {
				mult = await levels.multiplierFor(prisma, guild.id, member, wasIn);
			} catch {
				/* ignore */
			}

			const gain = Math.max(
				1,
				Math.round(
					(seconds / 60) *
						VOICE_XP_PER_MIN *
						(config.voiceMultiplier ?? 1) *
						mult,
				),
			);

			let res;
			try {
				res = await levels.addVoiceXp(
					prisma,
					guild.id,
					member.id,
					seconds,
					gain,
				);
			} catch (err) {
				log.warn(`addVoiceXp failed: ${err.message}`);
				return;
			}

			if (res?.leveledUp) {
				await levels.handleLevelUp(
					client,
					guild,
					member,
					config,
					res.after.level,
				);
			}
			return;
		}

		// Moved between channels — keep the running session as-is
	},
};
