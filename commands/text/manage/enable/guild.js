const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "26c859e0-f8aa-4ca3-8e93-c303cc734e98",
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
