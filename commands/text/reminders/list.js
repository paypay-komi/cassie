const { EmbedBuilder } = require("discord.js");
module.exports = {
	name: "list",
	description: "List all your reminders",
	aliases: ["ls", "l"],
	parent: "reminders",
	async execute(message, args) {
		const userId = message.author.id;
		const reminders = await message.client.db.prisma.reminder.findMany({
			where: { userId },
			orderBy: { remindAt: "asc" },
		});
		if (reminders.length === 0) {
			return message.reply("You have no reminders set.");
		}
		const embed = new EmbedBuilder()
			.setTitle(`${message.author.username}'s Reminders`)
			.setColor(0x00ff00);
		function pagateReminders(reminders, page = 0) {
			const itemsPerPage = 5;
			const start = page * itemsPerPage;
			const end = start + itemsPerPage;
			const pageReminders = reminders.slice(start, end);
			embed.setDescription(
				pageReminders
					.map(
						(r, i) =>
							`**${start + i + 1}.** ${r.content} - <t:${Math.floor(new Date(r.remindAt).getTime() / 1000)}:R>`,
					)
					.join("\n"),
			);
			if (embed.data.description.length > 4096) {
				embed.setDescription(
					"Too many reminders to display. Please delete some reminders to see the list.",
				);
			}
			return embed;
		}
		const totalPages = Math.ceil(reminders.length / 5);
		let currentPage = 0;
		const reminderMessage = await message.reply({
			embeds: [pagateReminders(reminders, currentPage)],
		});
		const buttons = [];
		if (totalPages > 1) {
			if (currentPage > 0) {
				buttons.push(
					new ButtonBuilder()
						.setCustomId("prev")
						.setLabel("Previous")
						.setStyle(ButtonStyle.Primary),
				);
			}
			if (currentPage < totalPages - 1) {
				buttons.push(
					new ButtonBuilder()
						.setCustomId("next")
						.setLabel("Next")
						.setStyle(ButtonStyle.Primary),
				);
			}
		}
		if (buttons.length > 0) {
			const row = new ActionRowBuilder().addComponents(buttons);
			await reminderMessage.edit({ components: [row] });
		}
		const collector = reminderMessage.createMessageComponentCollector({
			idle: 60000,
			filter: (i) => i.user.id === message.author.id,
		});
		collector.on("collect", async (i) => {
			if (i.customId === "prev") {
				currentPage--;
			} else if (i.customId === "next") {
				currentPage++;
			}
			await i.update({
				embeds: [pagateReminders(reminders, currentPage)],
			});
		});
	},
};
