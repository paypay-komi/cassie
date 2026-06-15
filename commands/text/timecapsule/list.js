const { PermissionsBitField, EmbedBuilder } = require("discord.js");

module.exports = {

commandId: "1a2f5440-28d8-4a05-b1f9-34e5008d5162",
	name: "list",
	description: "View your pending time capsules",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	aliases: ["ls", "pending", "all"],
	parent: "timecapsule",

	async execute(message) {
		const capsules = await message.client.db.prisma.timeCapsule.findMany({
			where: {
				userId: message.author.id,
				sentAt: null,
			},
			orderBy: { sendAt: "asc" },
		});

		if (capsules.length === 0) {
			return message.reply("You have no pending time capsules. Send one with `c.timecapsule send <time> <message>`!");
		}

		const embed = new EmbedBuilder()
			.setTitle(`${message.author.username}'s Time Capsules`)
			.setColor(0x9b59b6)
			.setDescription(
				capsules
					.map(
						(c, i) =>
							`**${i + 1}.** \`${c.id.slice(0, 8)}…\` — "${c.content.length > 50 ? c.content.slice(0, 50) + "…" : c.content}"\n` +
							`     Delivers <t:${Math.floor(c.sendAt.getTime() / 1000)}:R>`,
					)
					.join("\n\n"),
			)
			.setFooter({ text: `Use c.timecapsule cancel <id> to remove one` });

		await message.reply({ embeds: [embed] });
	},
};
