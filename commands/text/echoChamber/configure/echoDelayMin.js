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

commandId: "d1a20b5a-41d1-43e1-8a58-5ea86c135e78",
	name: "echoDelayMin",
	description: "View or set min time before echo after deletion (e.g. 0s, 30m, 2h)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const channelMention = args.shift();
		if (!channelMention) return message.reply("you need to specify a channel like `c.echochamber configure echoDelayMin #channel 0s`");

		const channelId = channelMention.replace(/[<#>]/g, "");
		const echoChannel = await db.prisma.echoChannel.findFirst({ where: { channelId } });
		if (!echoChannel) return message.reply("that channel isn't an echo chamber");

		const value = args.shift();
		if (!value) {
			return message.reply(`echo delay min for <#${channelId}> is \`${formatTime(echoChannel.echoDelayMin ?? 0)}\``);
		}

		const parsed = parseTime(value);
		if (parsed === null || parsed < 0) return message.reply("invalid time format — use e.g. 0s, 30m, 2h, 12h");

		await db.prisma.echoChannel.update({
			where: { id: echoChannel.id },
			data: { echoDelayMin: parsed },
		});

		message.reply(`set echo delay min to \`${formatTime(parsed)}\` for <#${channelId}>`);
	},
};
