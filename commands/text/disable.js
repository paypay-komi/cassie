const { resolveRequired } = require("../../lib/commandResolver");

module.exports = {
	commandId: "f3c4e2d1-9a8b-4c6d-8e7f-1a2b3c4d5e6f",
	name: "disable",
	description: "Disable a command guild-wide. Only the server owner can use this.",
	guildOwnerOnly: true,
	dmUse: false,

	async execute(message, args) {
		if (!args.length) {
			return message.reply("❌ Usage: `c.disable <command>`");
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

		// Invalidate the cached effective settings so the next command picks it up
		return message.reply(`✅ \`${input}\` has been disabled in this server.`);
	},
};
