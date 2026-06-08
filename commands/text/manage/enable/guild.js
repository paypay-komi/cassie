const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "guild",
	parent: "enable",
	description: "Re-enable a guild-wide disabled command. Usage: `c.manage enable guild <command>`",

	async execute(message, args) {
		if (!args.length) {
			return message.reply("❌ Usage: `c.manage enable guild <command>`");
		}

		const input = args.join(" ").toLowerCase();
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
