const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");
const parseTime = require("../../../../utils/parseTime");

function formatTime(ms) {
	if (!ms) return "0s";
	if (ms % 86400000 === 0) return `${ms / 86400000}d`;
	if (ms % 3600000 === 0) return `${ms / 3600000}h`;
	if (ms % 60000 === 0) return `${ms / 60000}m`;
	return `${ms / 1000}s`;
}

module.exports = {

commandId: "cd35c260-0e93-4153-b3af-c1c1a1a8b8a6",
	name: "deleteDelayMax",
	description: "View or set max time before message is deleted (e.g. 1m, 5m, 10m)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const channelMention = args.shift();
		if (!channelMention) return message.reply("you need to specify a channel like `c.echochamber configure deleteDelayMax #channel 5m`");

		const channelId = channelMention.replace(/[<#>]/g, "");
		const echoChannel = await db.prisma.echoChannel.findFirst({ where: { channelId } });
		if (!echoChannel) return message.reply("that channel isn't an echo chamber");

		const value = args.shift();
		if (!value) {
			return message.reply(`delete delay max for <#${channelId}> is \`${formatTime(echoChannel.deleteDelayMax ?? parseTime("1m"))}\``);
		}

		const parsed = parseTime(value);
		if (parsed === null || parsed < 0) return message.reply("invalid time format — use e.g. 30s, 1m, 5m, 10m");

		await db.prisma.echoChannel.update({
			where: { id: echoChannel.id },
			data: { deleteDelayMax: parsed },
		});

		message.reply(`set delete delay max to \`${formatTime(parsed)}\` for <#${channelId}>`);
	},
};
