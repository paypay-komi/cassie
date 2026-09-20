const { PermissionsBitField } = require("discord.js");
const tickets = require("../../../lib/tickets");
const { buildMessage } = require("../../../lib/v2Reply");
module.exports = {
	commandId: "a7d9ca49-0f61-4961-8973-9bfa6854d10a",
	name: "transcript",
	parent: "tickets",
	description: "Generate a transcript of a closed ticket",
	usage: "tickets transcript [channelId]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ModerateMembers],

	async execute(message, args) {
		const guild = message.guild;
		const channelId = args[0] || message.channel.id;

		const result = await tickets.generateTranscript(guild, channelId);
		if (result.error) return message.reply(buildMessage(result.error, 0xe05252));

		const chunk = result.transcript.length > 1900 ? result.transcript.slice(0, 1900) + "\n... (truncated)" : result.transcript;
		return message.reply(buildMessage(`## 📜 Transcript (${result.messageCount} messages)\n\`\`\`\n${chunk}\n\`\`\``, 0x5865f2));
	},
};