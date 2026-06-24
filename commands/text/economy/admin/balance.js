const { ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionsBitField } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {

commandId: "26d167e9-9cb8-4880-bb06-300c75f08afa",
	name: "balance",
	parent: "economy",
	description: "Set, add, or remove coins from a user.",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const econ = message.client.db.economy;
		const op = args[0];
		if (!["set", "add", "remove"].includes(op)) return message.reply(v2("Usage: `c.economy balance set/add/remove @user <amount>`"));

		const target = message.mentions.users.first();
		if (!target) return message.reply(v2("Mention a user."));

		const amount = parseInt(args[2], 10);
		if (isNaN(amount) || amount < 0) return message.reply(v2("Provide a valid non-negative amount."));

		const config = await econ.getConfig(message.guildId);
		const name = amount === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;

		try {
			if (op === "set") {
				await econ.setBalance(message.guildId, target.id, amount, "Admin set");
				message.reply(v2(`✅ Set ${target}'s balance to ${sym}**${amount.toLocaleString()}** ${name}.`));
			} else if (op === "add") {
				await econ.addBalance(message.guildId, target.id, amount, "admin_add", "Admin add");
				message.reply(v2(`✅ Added ${sym}**${amount.toLocaleString()}** ${name} to ${target}.`));
			} else if (op === "remove") {
				await econ.removeBalance(message.guildId, target.id, amount, "admin_remove", "Admin remove");
				message.reply(v2(`✅ Removed ${sym}**${amount.toLocaleString()}** ${name} from ${target}.`));
			}
		} catch (e) {
			if (e.message === "Insufficient balance") {
				message.reply(v2("That user doesn't have enough coins."));
			} else {
				throw e;
			}
		}
	},
};
