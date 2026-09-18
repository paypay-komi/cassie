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
	commandId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	name: "give",
	parent: "economy",
	description: "Give coins to a user (admin only).",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const econ = message.client.db.economy;

		const target = message.mentions.users.first();
		if (!target)
			return message.reply(
				v2("Usage: `c.economy give @user <amount>`"),
			);

		const amount = parseInt(args[1], 10);
		if (isNaN(amount) || amount <= 0)
			return message.reply(v2("Provide a valid positive amount."));

		const current = await econ.getBalance(message.guildId, target.id);
		if (current + amount > econ.MAX_BALANCE)
			return message.reply(v2(econ.overflowMessage(current, amount)));

		const config = await econ.getConfig(message.guildId);
		const name =
			amount === 1 ? config.currencyName : config.currencyNamePlural;
		const sym = config.currencySymbol;

		try {
			await econ.addBalance(
				message.guildId,
				target.id,
				amount,
				"admin_give",
				"Admin give",
			);
		} catch (e) {
			if (e.code === "P2020")
				return message.reply(
					v2(econ.overflowMessage(current, amount)),
				);
			throw e;
		}

		message.reply(
			v2(
				`✅ Gave ${sym}**${amount.toLocaleString()}** ${name} to ${target}.`,
			),
		);
	},
};