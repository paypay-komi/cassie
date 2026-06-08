const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "allow",
	parent: "user",
	description:
		"Allow a user to use a command. Usage: `c.manage user @user allow <command>`",

	async execute(message, args) {
		const target = this._middleArgs?.[0];
		if (!target || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage user @user allow <command>`",
			);
		}

		const userId = target.replace(/[<@!>]/g, "");
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
			true,
		);

		return message.reply(
			`✅ **${userName}** is now allowed to use \`${input}\`.`,
		);
	},
};
