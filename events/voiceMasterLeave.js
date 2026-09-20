const { getLogger } = require("../lib/logger");
const vm = require("../lib/voiceMaster");

const log = getLogger("VMLeave");

module.exports = {
	name: "voiceMasterLeave",
	description: "Deletes empty temp voice channels",

	async execute(client, oldState, newState) {
		if (!oldState.channelId || !newState.guild) return;
		if (oldState.channelId === newState.channelId) return;

		const prisma = client.db.prisma;
		const guild = newState.guild;
		const channelId = oldState.channelId;

		const cfg = await vm.getConfig(prisma, guild.id);
		if (!cfg || !cfg.temporary) return;

		const vc = await prisma.voiceChannel.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!vc) return;

		const ch = guild.channels.cache.get(channelId);
		if (!ch || ch.members.size > 0) return;

		// Channel is empty — delete it
		await ch.delete("Empty temp channel").catch(() => {});
		await prisma.voiceChannel.delete({ where: { channelId } }).catch(() => {});
		await prisma.voiceChannelMember.deleteMany({ where: { channelId } }).catch(() => {});
	},
};