const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "clear",
	parent: "user",
	description:
		"Remove a user's command access override. Usage: `c.manage user @user clear <command>`",

	async execute(message, args) {
		const target = this._middleArgs?.[0];
		if (!target || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage user @user clear <command>`",
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

		await message.client.db.commandAccess.removeUserAccess(
			message.guildId,
			userId,
			commandId,
		);

		return message.reply(
			`✅ Cleared override for **${userName}** on \`${input}\`.`,
		);
	},
};
