const { resolveRequired } = require("../../lib/commandResolver");

module.exports = {
	commandId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	name: "enable",
	description: "Re-enable a disabled command. Only the server owner can use this.",
	guildOwnerOnly: true,
	dmUse: false,

	async execute(message, args) {
		if (!args.length) {
			return message.reply("❌ Usage: `c.enable <command>`");
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
