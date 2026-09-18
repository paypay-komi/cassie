const {
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
	PermissionsBitField,
} = require("discord.js");

function v2(text) {
	return {
		components: [
			new ContainerBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(text),
			),
		],
		flags: MessageFlags.IsComponentsV2,
	};
}

module.exports = {
	commandId: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
	name: "set",
	parent: "economy",
	description: "Set a user's coin balance directly (admin only).",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const econ = message.client.db.economy;

		const target = message.mentions.users.first();
		if (!target)
			return message.reply(
				v2("Usage: `c.economy set @user <amount>`"),
			);

		const amount = parseInt(args[1], 10);
		if (isNaN(amount) || amount < 0)
			return message.reply(v2("Provide a valid non-negative amount."));

		if (amount > econ.MAX_BALANCE)
			return message.reply(v2(econ.overflowMessage(0, amount)));

		const config = await econ.getConfig(message.guildId);
		const name =
			amount === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;

		try {
			await econ.setBalance(
				message.guildId,
				target.id,
				amount,
				"Admin set",
			);
		} catch (e) {
			if (e.code === "P2020")
				return message.reply(
					v2(
						`❌ **Balance limit reached**\nThis user's tracked totals are already at the maximum a 32-bit integer can hold (**${econ.MAX_BALANCE.toLocaleString()}**), so that change can't be saved.`,
					),
				);
			throw e;
		}

		message.reply(
			v2(
				`✅ Set ${target}'s balance to ${sym}**${amount.toLocaleString()}** ${name}.`,
			),
		);
	},
};