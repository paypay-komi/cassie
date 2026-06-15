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

commandId: "e73c9571-fec1-4a0d-80ad-8330e52ea174",
	name: "deleteDelayMin",
	description: "View or set min time before message is deleted (e.g. 5s, 30s, 2m)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const channelMention = args.shift();
		if (!channelMention) return message.reply("you need to specify a channel like `c.echochamber configure deleteDelayMin #channel 10s`");

		const channelId = channelMention.replace(/[<#>]/g, "");
		const echoChannel = await db.prisma.echoChannel.findFirst({ where: { channelId } });
		if (!echoChannel) return message.reply("that channel isn't an echo chamber");

		const value = args.shift();
		if (!value) {
			return message.reply(`delete delay min for <#${channelId}> is \`${formatTime(echoChannel.deleteDelayMin ?? parseTime("10s"))}\``);
		}

		const parsed = parseTime(value);
		if (parsed === null || parsed < 0) return message.reply("invalid time format — use e.g. 10s, 30s, 2m, 5m");

		await db.prisma.echoChannel.update({
			where: { id: echoChannel.id },
			data: { deleteDelayMin: parsed },
		});

		message.reply(`set delete delay min to \`${formatTime(parsed)}\` for <#${channelId}>`);
	},
};
