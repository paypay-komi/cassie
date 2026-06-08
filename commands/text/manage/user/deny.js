const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "deny",
	parent: "user",
	description:
		"Deny a user from using a command. Usage: `c.manage user @user deny <command>`",

	async execute(message, args) {
		const userId = this.parentRef?._targetUser;
		if (!userId || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage user @user deny <command>`",
			);
		}

		let userName = userId;
		try {
			const user = await message.client.users.fetch(userId);
			userName = user.tag;
		} catch { /* keep raw ID */ }

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
