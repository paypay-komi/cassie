const { resolveRequired, getAllCommandIds } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "24ca7e3c-5898-4358-8952-d507602764c2",
	name: "user",
	parent: "disable",
	description:
		"Deny a user from using commands. Usage: `c.manage disable user @user <command>` or `c.manage disable user @user all`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage disable user @user <command>` or `c.manage disable user @user all`",
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

		if (input === "all") {
			const { prisma } = message.client.db;
			const allIds = getAllCommandIds(message.client);
			await prisma.$transaction([
				prisma.guildUserCommandAccess.deleteMany({
					where: { guildId: message.guildId, userId },
				}),
				prisma.guildUserCommandAccess.createMany({
					data: allIds.map((id) => ({
						guildId: message.guildId,
						userId,
						commandId: id,
						allowed: false,
					})),
				}),
			]);
			return message.reply(
				`🚫 **${userName}** is now denied from using all commands.`,
			);
		}

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
