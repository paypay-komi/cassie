const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "2349ac7a-dbae-4eb1-b9da-11c02d0c0bbf",
	name: "reset",
	parent: "economy",
	description: "Wipe all economy data for this guild (bot owner only).",
	permissions: ["botOwner"],

	async execute(message, args) {
		const confirm = args[0];
		if (confirm !== "--confirm") {
			return message.reply(v2("⚠️ This will **permanently delete** all balances, transactions, and config for this guild.\nRun `c.economy reset --confirm` to proceed."));
		}

		await message.client.db.economy.resetGuild(message.guildId);
		message.reply(v2("✅ All economy data for this guild has been wiped."));
	},
};
