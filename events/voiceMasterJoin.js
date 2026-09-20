const { getLogger } = require("../lib/logger");
const vm = require("../lib/voiceMaster");

const log = getLogger("VMJoin");

module.exports = {
	name: "voiceMasterJoin",
	description: "Creates temp voice channels when someone joins a hub",

	async execute(client, oldState, newState) {
		if (!newState.channelId || !newState.guild) return;
		if (oldState.channelId === newState.channelId) return;

		const prisma = client.db.prisma;
		const guild = newState.guild;
		const channelId = newState.channelId;

		const hub = await prisma.voiceMasterHub.findUnique({
			where: { guildId_channelId: { guildId: guild.id, channelId } },
		});
		if (!hub) return;

		const member = newState.member;
		if (!member) return;

		const result = await vm.createTempChannel({ client, guild, creator: member, prisma });
		if (result.error) return log.warn("Could not create temp channel: " + result.error);

		// Move user into the new channel
		try {
			await member.voice.setChannel(result.channelId);
		} catch (err) {
			log.warn("Failed to move member: " + err.message);
		}
	},
};