const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");
const vm = require("../lib/voiceMaster");

const log = getLogger("VMJoin");

module.exports = {
	name: Events.VoiceStateUpdate,
	description: "Creates temp voice channels when someone joins a hub",

	async execute(client, oldState, newState) {
		if (!newState.channelId || !newState.guild) return;
		if (oldState.channelId === newState.channelId) return;

		const member = newState.member;
		if (!member || member.user.bot) return;

		const prisma = client.db.prisma;
		const guild = newState.guild;
		const channelId = newState.channelId;

		const hub = await prisma.voiceMasterHub.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!hub) return;

		const result = await vm.createTempChannel({ client, guild, creator: member, prisma });
		if (result.error) {
			log.warn("Could not create temp channel: " + result.error);
			return;
		}

		if (member.voice.channelId !== channelId) {
			const created = guild.channels.cache.get(result.channelId);
			if (created) await created.delete("Creator left the hub before moving").catch(() => {});
			await prisma.voiceChannel.delete({ where: { channelId: result.channelId } }).catch(() => {});
			return;
		}

		try {
			await member.voice.setChannel(result.channelId, "VoiceMaster join-to-create");
		} catch (err) {
			log.warn("Failed to move member: " + err.message);
			const created = guild.channels.cache.get(result.channelId);
			if (created) await created.delete("Could not move creator").catch(() => {});
			await prisma.voiceChannel.delete({ where: { channelId: result.channelId } }).catch(() => {});
		}
	},
};
