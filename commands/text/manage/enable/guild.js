const { resolveRequired, getAllCommandIds } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "26c859e0-f8aa-4ca3-8e93-c303cc734e98",
	name: "guild",
	parent: "enable",
	description: "Re-enable commands guild-wide. Usage: `c.manage enable guild <command>` or `c.manage enable guild all`",

	async execute(message, args) {
		if (!args.length) {
			return message.reply("❌ Usage: `c.manage enable guild <command>` or `c.manage enable guild all`");
		}

		const input = args.join(" ").toLowerCase();

		if (input === "all") {
			await message.client.db.prisma.guildDisabledCommand.deleteMany({
				where: { guildId: message.guildId },
			});
			return message.reply("✅ All commands have been re-enabled in this server.");
		}

		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.commandAccess.setGuildDisabled(
			message.guildId,
			commandId,
			false,
		);

		return message.reply(`✅ \`${input}\` has been re-enabled in this server.`);
	},
};
