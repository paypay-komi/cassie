const { resolveRequired, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "8a042c44-0884-437b-92aa-f5e16ac7eb67",
	name: "guild",
	parent: "reset",
	description:
		"Remove the guild-wide disable for a command. Usage: `c.manage reset guild <command>`",
	args: ArgsBuilder.create()
		.string("command", { autocomplete: suggestCommandNames, required: true, description: "The command to reset" }),

	async execute(message, args) {
		if (!args.length) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage reset guild <command>`",
			));
		}

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.prisma.guildDisabledCommand.deleteMany({
			where: { guildId: message.guildId, commandId },
		});

		return message.reply(pingSafeMesage(
			`✅ Guild override removed for \`${input}\`. It now uses default permissions.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
