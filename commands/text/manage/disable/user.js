const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "24ca7e3c-5898-4358-8952-d507602764c2",
	name: "user",
	parent: "disable",
	description: "Deny a user from using commands.",
	args: ArgsBuilder.create()
		.user("user", { required: true, description: "The user to restrict" })
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage disable user @user <command>` or `c.manage disable user @user all`",
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
						allowed: false,
					})),
				}),
			]);
			return message.reply(pingSafeMesage(
				`🚫 **${userName}** is now denied from using all commands.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
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
			false,
		);

		return message.reply(pingSafeMesage(
			`🚫 **${userName}** is now denied from using \`${input}\`.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
