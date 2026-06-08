const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "fe3e2ff1-80f9-4e14-ae2b-827504bb4376",
	name: "guild",
	parent: "disable",
	description: "Disable a command guild-wide. Usage: `c.manage disable guild <command>`",

	async execute(message, args) {
		if (!args.length) {
			return message.reply("❌ Usage: `c.manage disable guild <command>`");
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
			true,
		);

		return message.reply(`✅ \`${input}\` has been disabled in this server.`);
	},
};
