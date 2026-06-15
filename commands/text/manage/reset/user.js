const { resolveRequired, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "5f5b5609-a641-46a1-8de0-7ba3913ebca6",
	name: "user",
	parent: "reset",
	description:
		"Remove user-level allow/deny for a command. Usage: `c.manage reset user @user <command>`",
	args: ArgsBuilder.create()
		.user("user", { required: true, description: "The user" })
		.string("command", { autocomplete: suggestCommandNames, required: true, description: "The command to reset" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage reset user @user <command>`",
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
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.prisma.guildUserCommandAccess.deleteMany({
			where: { guildId: message.guildId, userId, commandId },
		});

		return message.reply(pingSafeMesage(
			`✅ Override removed for **${userName}** on \`${input}\`. It now uses default permissions.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
