const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "26c859e0-f8aa-4ca3-8e93-c303cc734e98",
	name: "guild",
	parent: "enable",
	description: "Re-enable a command guild-wide.",
	args: ArgsBuilder.create()
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (!args.length) {
			return message.reply(pingSafeMesage("❌ Usage: `c.manage enable guild <command>` or `c.manage enable guild all`"));
		}

		const input = args.join(" ").toLowerCase();

		if (input === "all") {
			await message.client.db.prisma.guildDisabledCommand.deleteMany({
				where: { guildId: message.guildId },
			});
			return message.reply(pingSafeMesage("✅ All commands have been re-enabled in this server.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
		}

		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.commandAccess.setGuildDisabled(
			message.guildId,
			commandId,
			false,
		);

		return message.reply(pingSafeMesage(`✅ \`${input}\` has been re-enabled in this server.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`));
	},
};
