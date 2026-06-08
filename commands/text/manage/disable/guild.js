const { resolveRequired, getAllCommandIds } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "fe3e2ff1-80f9-4e14-ae2b-827504bb4376",
	name: "guild",
	parent: "disable",
	description: "Disable commands guild-wide. Usage: `c.manage disable guild <command>` or `c.manage disable guild all`",

	async execute(message, args) {
		if (!args.length) {
			return message.reply("❌ Usage: `c.manage disable guild <command>` or `c.manage disable guild all`");
		}

		const input = args.join(" ").toLowerCase();

		if (input === "all") {
			const allIds = getAllCommandIds(message.client);
			await message.client.db.prisma.guildDisabledCommand.createMany({
				data: allIds.map((id) => ({
					guildId: message.guildId,
					commandId: id,
				})),
				skipDuplicates: true,
			});
			return message.reply(`✅ **${allIds.length}** commands have been disabled in this server.`);
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
			true,
		);

		return message.reply(`✅ \`${input}\` has been disabled in this server.`);
	},
};
