const { resolveRequired, getAllCommandIds } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "9cb0310c-0b4b-47e0-8cca-578b8c10aa06",
	name: "user",
	parent: "enable",
	description:
		"Allow a user to use commands. Usage: `c.manage enable user @user <command>` or `c.manage enable user @user all`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage enable user @user <command>` or `c.manage enable user @user all`",
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
						allowed: true,
					})),
				}),
			]);
			return message.reply(
				`✅ **${userName}** is now allowed to use all commands.`,
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
			true,
		);

		return message.reply(
			`✅ **${userName}** is now allowed to use \`${input}\`.`,
		);
	},
};
