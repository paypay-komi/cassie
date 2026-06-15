const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "fe3e2ff1-80f9-4e14-ae2b-827504bb4376",
	name: "guild",
	parent: "disable",
	description: "Disable a command guild-wide.",
	args: ArgsBuilder.create()
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (!args.length) {
			return message.reply(pingSafeMesage("❌ Usage: `c.manage disable guild <command>` or `c.manage disable guild all`"));
		}

		const input = args.join(" ").toLowerCase();

		if (input === "all") {
			const allIds = getAllCommandIds(message.client);
			await message.client.db.prisma.guildDisabledCommand.createMany({
				data: allIds.map((id) => ({
					guildId: message.guildId,
					commandId: id,
				})),
				skipDuplicates: true,
			});
			return message.reply(pingSafeMesage(`✅ **${allIds.length}** commands have been disabled in this server.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`));
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
			true,
		);

		return message.reply(pingSafeMesage(`✅ \`${input}\` has been disabled in this server.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`));
	},
};
