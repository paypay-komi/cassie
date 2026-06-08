const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "8a042c44-0884-437b-92aa-f5e16ac7eb67",
	name: "guild",
	parent: "reset",
	description:
		"Remove the guild-wide disable for a command. Usage: `c.manage reset guild <command>`",

	async execute(message, args) {
		if (!args.length) {
			return message.reply(
				"❌ Usage: `c.manage reset guild <command>`",
			);
		}

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.prisma.guildDisabledCommand.deleteMany({
			where: { guildId: message.guildId, commandId },
		});

		return message.reply(
			`✅ Guild override removed for \`${input}\`. It now uses default permissions.`,
		);
	},
};
