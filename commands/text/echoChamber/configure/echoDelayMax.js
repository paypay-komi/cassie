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

commandId: "ffafd950-38d0-4e84-9a71-cf47e10aedf2",
	name: "echoDelayMax",
	description: "View or set max time before echo after deletion (e.g. 6h, 12h, 24h, 2d)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const channelMention = args.shift();
		if (!channelMention) return message.reply("you need to specify a channel like `c.echochamber configure echoDelayMax #channel 1d`");

		const channelId = channelMention.replace(/[<#>]/g, "");
		const echoChannel = await db.prisma.echoChannel.findFirst({ where: { channelId } });
		if (!echoChannel) return message.reply("that channel isn't an echo chamber");

		const value = args.shift();
		if (!value) {
			return message.reply(`echo delay max for <#${channelId}> is \`${formatTime(echoChannel.echoDelayMax ?? parseTime("2h"))}\``);
		}

		const parsed = parseTime(value);
		if (parsed === null || parsed < 0) return message.reply("invalid time format — use e.g. 6h, 12h, 1d, 2d");

		await db.prisma.echoChannel.update({
			where: { id: echoChannel.id },
			data: { echoDelayMax: parsed },
		});

		message.reply(`set echo delay max to \`${formatTime(parsed)}\` for <#${channelId}>`);
	},
};
