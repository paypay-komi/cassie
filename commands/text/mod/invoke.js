const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

const COMMANDS = ["warn", "kick", "ban", "hardban", "softban", "timeout", "jail", "imute", "rmute"];

module.exports = {

commandId: "528d5df6-f427-470f-8e76-2dac268f4e31",
	name: "invoke",
	parent: "mod",
	description: "Configure DM/mod-channel invoke messages for punishments",
	usage: "mod invoke list | mod invoke <command> <dm|message> <content> | mod invoke reset <command> <dm|message>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		if (args[0] === "list") {
			const configs = await prisma.invokeConfig.findMany({
				where: { guildId: guild.id },
				orderBy: { command: "asc" },
			});
			if (!configs.length)
				return message.reply(buildMessage("No invoke messages configured.\nSet one with `mod invoke <command> <dm|message> <content>`."));

			const lines = [
				"## 📨 Invoke messages",
				...configs.map(
					(c) => `\`${c.command}\` **${c.type}** — ${(c.content.length > 70 ? c.content.slice(0, 70) + "..." : c.content) || "*empty*"}`,
				),
			];
			return message.reply(buildMessage(lines.join("\n"), 0x5865f2));
		}

		if (args[0] === "reset") {
			const command = args[1];
			const type = args[2];
			if (!command || !type || !COMMANDS.includes(command) || !["dm", "message"].includes(type))
				return message.reply(buildMessage("Usage: `mod invoke reset <command> <dm|message>`"));
			await prisma.invokeConfig.deleteMany({ where: { guildId: guild.id, command, type } });
			return message.reply(buildMessage(`Removed ${command}/${type} invoke message.`));
		}

		const command = args[0];
		const type = args[1];
		const content = args.slice(2).join(" ");

		if (!command || !COMMANDS.includes(command))
			return message.reply(buildMessage(`Valid commands: ${COMMANDS.join(", ")}`));
		if (!type || !["dm", "message"].includes(type))
			return message.reply(buildMessage("Type must be `dm` (DMs the user) or `message` (posts in this channel)."));
		if (!content) return message.reply(buildMessage("Provide the invoke content."));

		await prisma.invokeConfig.upsert({
			where: { guildId_command_type: { guildId: guild.id, command, type } },
			create: { guildId: guild.id, command, type, content },
			update: { content },
		});

		return message.reply(
			buildMessage(
				`Invoke message set for **${command}** (${type}).\nTokens: {user} {user.tag} {moderator} {guild} {reason} {duration} {case} {channel}`,
				0x57f287,
			),
		);
	},
};