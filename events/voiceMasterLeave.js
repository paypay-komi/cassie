const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");
const vm = require("../lib/voiceMaster");

const log = getLogger("VMLeave");

module.exports = {
	name: Events.VoiceStateUpdate,
	description: "Deletes empty temp voice channels",

	async execute(client, oldState, newState) {
		if (!oldState.channelId) return;
		if (oldState.channelId === newState.channelId) return;

		const guild = oldState.guild || newState.guild;
		if (!guild) return;

		const prisma = client.db.prisma;
		const channelId = oldState.channelId;

		const cfg = await vm.getConfig(prisma, guild.id);
		if (!cfg || !cfg.temporary) return;

		const vc = await prisma.voiceChannel.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!vc) return;

		const channel = guild.channels.cache.get(channelId);
		if (channel && channel.members.size > 0) return;

		if (channel) {
			await channel.delete("Empty VoiceMaster channel").catch((err) => {
				log.warn("Failed to delete empty temp channel: " + err.message);
			});
		}

		await prisma.voiceChannel.delete({ where: { channelId } }).catch(() => {});
		await prisma.voiceChannelMember.deleteMany({ where: { channelId } }).catch(() => {});
	},
};
