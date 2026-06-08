const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "user",
	parent: "disable",
	description:
		"Deny a user from using a command. Usage: `c.manage disable user @user <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage disable user @user <command>`",
			);
		}

		const raw = args.shift();
		const userId = raw.replace(/[<@!>]/g, "");
		let userName = userId;
		try {
			const user = await message.client.users.fetch(userId);
			userName = user.tag;
		} catch {
			return message.reply("❌ User not found.");
		}

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.commandAccess.setUserAccess(
			message.guildId,
			userId,
			commandId,
			false,
		);

		return message.reply(
			`🚫 **${userName}** is now denied from using \`${input}\`.`,
		);
	},
};
