const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const db = require("../../../db");

module.exports = {

commandId: "e2e8254b-6c8a-4308-8e47-97899486e8a9",
	name: "status",
	description: "Show echo chamber channels and pending messages",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.EmbedLinks,
	],
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	parent: "echochamber",
	aliases: ["info", "list"],
	/**
	 * @param {import("discord.js").Message<true>} message
	 */
	async execute(message) {
		const channels = await db.prisma.echoChannel.findMany({
			where: { guildId: message.guild.id },
		});

		if (channels.length === 0) {
			return message.reply("No echo chambers set up in this server. Use `c.echochamber create` in a channel to make one.");
		}

		const lines = await Promise.all(
			channels.map(async (ch) => {
				const count = await db.prisma.echoMessage.count({
					where: {
						channelId: ch.channelId,
						deliveredAt: null,
					},
				});
				const mention = `<#${ch.channelId}>`;
				return `${mention} — **${count}** pending`;
			}),
		);

		const nextMsg = await db.prisma.echoMessage.findFirst({
			where: { deliveredAt: null },
			orderBy: { deliverAt: "asc" },
		});

		const embed = new EmbedBuilder()
			.setTitle("Echo Chambers")
			.setColor(0x9b59b6)
			.setDescription(lines.join("\n"));

		if (nextMsg) {
			const ts = Math.floor(nextMsg.deliverAt.getTime() / 1000);
			lines.push(
				`\n**Next echo** <t:${ts}:R> — <#${nextMsg.channelId}>`,
			);
			embed.setDescription(lines.join("\n"));
		}

		await message.reply({ embeds: [embed] });
	},
};
