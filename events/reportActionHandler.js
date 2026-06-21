const { Events, MessageFlags } = require("discord.js");
const db = require("../db");

module.exports = {
	name: Events.InteractionCreate,
	description: "handles wrong-action report buttons",

	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		if (!interaction.customId.startsWith("report_")) return;

		const parts = interaction.customId.split("_");
		const gifId = parts[1];
		const action = parts.slice(2).join("_");

		const existing = await db.prisma.reactionGifReport.findUnique({
			where: {
				gifId_action_userId: {
					gifId,
					action,
					userId: interaction.user.id,
				},
			},
		});

		if (existing) {
			return interaction.reply({
				content: "You already reported this GIF for this action.",
				flags: MessageFlags.Ephemeral,
			});
		}

		await db.prisma.reactionGifReport.create({
			data: { gifId, action, userId: interaction.user.id },
		});

		await interaction.reply({
			content: "Reported! Thanks for helping keep actions accurate.",
			flags: MessageFlags.Ephemeral,
		});
	},
};
