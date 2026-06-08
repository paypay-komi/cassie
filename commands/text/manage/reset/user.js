const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "user",
	parent: "reset",
	description:
		"Remove user-level allow/deny for a command. Usage: `c.manage reset user @user <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage reset user @user <command>`",
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

		await message.client.db.prisma.guildUserCommandAccess.deleteMany({
			where: { guildId: message.guildId, userId, commandId },
		});

		return message.reply(
			`✅ Override removed for **${userName}** on \`${input}\`. It now uses default permissions.`,
		);
	},
};
