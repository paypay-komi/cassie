const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "9cb0310c-0b4b-47e0-8cca-578b8c10aa06",
	name: "user",
	parent: "enable",
	description:
		"Allow a user to use a command. Usage: `c.manage enable user @user <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage enable user @user <command>`",
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
			true,
		);

		return message.reply(
			`✅ **${userName}** is now allowed to use \`${input}\`.`,
		);
	},
};
