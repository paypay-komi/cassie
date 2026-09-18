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
	commandId: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
	name: "take",
	parent: "economy",
	description: "Take coins from a user (admin only).",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const econ = message.client.db.economy;

		const target = message.mentions.users.first();
		if (!target)
			return message.reply(
				v2("Usage: `c.economy take @user <amount>`"),
			);

		const amount = parseInt(args[1], 10);
		if (isNaN(amount) || amount <= 0)
			return message.reply(v2("Provide a valid positive amount."));

		const config = await econ.getConfig(message.guildId);
		const name =
			amount === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;

		try {
			await econ.removeBalance(
				message.guildId,
				target.id,
				amount,
				"admin_take",
				"Admin take",
			);
		} catch (e) {
			if (e.message === "Insufficient balance") {
				return message.reply(
					v2("That user doesn't have enough coins."),
				);
			}
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
				`✅ Took ${sym}**${amount.toLocaleString()}** ${name} from ${target}.`,
			),
		);
	},
};