const { Events, Client, VoiceState } = require("discord.js");
const prisma = require("../prisma/client");

const voiceSessions = new Map();

module.exports = {
	name: Events.VoiceStateUpdate,
	description: "updates member voice activity",

	/**
	 * @param {Client} client
	 * @param {VoiceState} oldState
	 * @param {VoiceState} newState
	 */
	async execute(client, oldState, newState) {
		if (newState.member?.user.bot) return;

		const key = `${newState.guild.id}:${newState.id}`;

		// Joined
		if (!oldState.channelId && newState.channelId) {
			voiceSessions.set(key, Date.now());
			return;
		}

		// Moved channels
		if (oldState.channelId && newState.channelId) return;

		// Left
		if (oldState.channelId && !newState.channelId) {
			const startedAt = voiceSessions.get(key);
			if (!startedAt) return;

			voiceSessions.delete(key);

			const seconds = Math.floor((Date.now() - startedAt) / 1000);

			if (seconds <= 0) return;

			await prisma.guildMemberActivity.upsert({
				where: {
					guildId_userId: {
						guildId: oldState.guild.id,
						userId: oldState.id,
					},
				},
				create: {
					guildId: oldState.guild.id,
					userId: oldState.id,
					voiceSeconds: seconds,
				},
				update: {
					voiceSeconds: {
						increment: seconds,
					},
				},
			});
		}
	},
};
