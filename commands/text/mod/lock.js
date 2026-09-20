const { PermissionsBitField, PermissionFlagsBits } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "df5d86a3-60b0-4d95-a454-fa180502a224",
	name: "lock",
	parent: "mod",
	description: "Lock a channel (block @everyone from sending)",
	usage: "mod lock [channel] [reason]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	async execute(message, args) {
		const channel = message.mentions.channels.first() || message.channel;
		const reason =
			args.filter((a) => !/^<#\d+>$/.test(a)).join(" ") || "No reason provided";

		try {
			await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
				[PermissionFlagsBits.SendMessages]: false,
			});
			await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
				[PermissionFlagsBits.AddReactions]: false,
			});
		} catch (err) {
			return message.reply(buildMessage(`Failed to lock: ${err.message}`, 0xe05252));
		}

		return message.reply(buildMessage(`🔒 ${channel} locked — ${reason}`, 0xe05252));
	},
};