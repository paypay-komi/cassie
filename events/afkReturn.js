const { Component, ComponentType, MessageFlags } = require("discord.js");
const {
	Events,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Client,
	Message,
} = require("discord.js");
const db = require("./../db/boobs.js");
module.exports = {
	name: Events.MessageCreate,
	/**
	 *
	 * @param {Client} client
	 * @param {Message} message
	 * @returns
	 */
	async execute(client, message) {
		const user = message.author;

		if (!client.afk.has(user.id)) return;
		const afkData = client.afk.get(user.id);
		if (!afkData.SnoozeTime) afkData.SnoozeTime = Date.now();
		if (afkData.SnoozeTime > Date.now()) return;
		const afk_buttons = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`AFK_${user.id}_keep`)
				.setLabel("❎")
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setCustomId(`AFK_${user.id}_remove`)
				.setLabel("✅")
				.setStyle(ButtonStyle.Primary),
		);
		const interaction_message = await message.reply({
			content: "do you want to remove your afk",
			components: [afk_buttons],
		});
		const collector = interaction_message.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time: 60_000,
		}); // idle for 60 secounds
		collector.on("collect", async (interaction) => {
			const [_, collected_id, action] = interaction.customId.split("_");
			if (interaction.user.id != collected_id)
				return await interaction.reply({
					content: "this is not your button",
					flags: MessageFlags.Ephemeral,
				});
			if (action == "keep") {
				await interaction.reply({
					content: "got it snoozing this message for 1 minute",
					flags: MessageFlags.Ephemeral,
				});
				return collector.stop("kept");
			}
			if (action == "remove") {
				interaction.reply({
					content: "removing afk",
					flags: MessageFlags.Ephemeral,
				});
				return collector.stop("removed");
			}
		});
		collector.on("end", async (collected, reason) => {
			await interaction_message.delete().catch();

			if (reason == "kept") return;
			if (reason == "time") return;
			await db.prisma.globalAfkUser.delete({
				where: { userId: message.author.id },
			});
			client.afk.delete(message.author.id);
		});
		afkData.SnoozeTime = Date.now() + 60_000;
	},
};
