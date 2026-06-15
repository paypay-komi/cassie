const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "9cb0310c-0b4b-47e0-8cca-578b8c10aa06",
	name: "user",
	parent: "enable",
	description: "Allow a user to use commands.",
	args: ArgsBuilder.create()
		.user("user", { required: true, description: "The user to unrestrict" })
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage enable user @user <command>` or `c.manage enable user @user all`",
			));
		}

		const raw = args.shift();
		const userId = raw.replace(/[<@!>]/g, "");
		let userName = userId;
		try {
			const user = await message.client.users.fetch(userId);
			userName = user.tag;
		} catch {
			return message.reply(pingSafeMesage("❌ User not found."));
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
			return message.reply(pingSafeMesage(
				`✅ **${userName}** is now allowed to use all commands.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
			));
		}

		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.commandAccess.setUserAccess(
			message.guildId,
			userId,
			commandId,
			true,
		);

		return message.reply(pingSafeMesage(
			`✅ **${userName}** is now allowed to use \`${input}\`.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
