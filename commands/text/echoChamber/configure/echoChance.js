const { PermissionsBitField } = require("discord.js");
const db = require("../../../../db");

module.exports = {

commandId: "4add6c92-5cc6-4d1b-8b23-0cd293eb60ae",
	name: "echoChance",
	description: "View or set echo chance (0-100)",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],
	parent: "configure",

	async execute(message, args) {
		const channelMention = args.shift();
		if (!channelMention) return message.reply("you need to specify a channel like `c.echochamber configure echoChance #channel 85`");

		const channelId = channelMention.replace(/[<#>]/g, "");
		const echoChannel = await db.prisma.echoChannel.findFirst({ where: { channelId } });
		if (!echoChannel) return message.reply("that channel isn't an echo chamber");

		const value = args.shift();
		if (!value) {
			return message.reply(`echo chance for <#${channelId}> is \`${echoChannel.echoChance ?? 85}%\``);
		}

		const parsed = parseFloat(value);
		if (isNaN(parsed) || parsed < 0 || parsed > 100) return message.reply("must be a number between 0 and 100");

		await db.prisma.echoChannel.update({
			where: { id: echoChannel.id },
			data: { echoChance: parsed },
		});

		message.reply(`set echo chance to \`${parsed}%\` for <#${channelId}>`);
	},
};
