const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
	MessageFlags,
	TextDisplayBuilder,
	SectionBuilder,
	ContainerBuilder,
} = require("discord.js");
const db = require("../../../db/boobs.js");
/**
 * @param {number} page
 * @param {(data: import('discord.js').InteractionReplyOptions) => Promise<void>} responder
 * @param {import('discord.js').Interaction | import('discord.js').Message} source
 */

async function makeIdeaStuff(page, source) {
	const userId = source.user?.id ?? source.author?.id;

	const {
		ideas,
		page: safePage,
		totalPages,
		wrapped,
	} = await db.ideas.getIdeasPage(page, userId, { pageSize: 7 });

	const navButtons = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(
				`ideaViewer_${userId}_changePage_${safePage}_-1_${totalPages}`,
			)
			.setLabel("⬅️")
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(
				`ideaViewer_${userId}_changePage_${safePage}_1_${totalPages}`,
			)
			.setLabel("➡️")
			.setStyle(ButtonStyle.Secondary),
	);

	const ideaContainers = ideas.map((idea, i) => {
		const content =
			idea.content.length > 1024
				? idea.content.slice(0, 1021) + "..."
				: idea.content;
		const userVote = idea.votes?.find((v) => v.userId === userId);
		const userUpvoted = userVote?.value === 1;
		const userDownvoted = userVote?.value === -1;

		console.log(ButtonStyle);
		return new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`**Idea #${(safePage - 1) * 7 + i + 1}** votes: ${idea.vote_score}\n${content}`,
				),
			)

			.addActionRowComponents(
				new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(
							`ideaViewer_${userId}_upvote_${safePage}_${idea.id}`,
						)
						.setLabel("👍")
						.setStyle(
							userUpvoted
								? ButtonStyle.Success
								: ButtonStyle.Secondary,
						),
					new ButtonBuilder()
						.setCustomId(
							`ideaViewer_${userId}_downvote_${safePage}_${idea.id}`,
						)
						.setLabel("👎")
						.setStyle(
							userDownvoted
								? ButtonStyle.Danger
								: ButtonStyle.Secondary,
						),
				),
			);
	});
	ideaContainers.push(
		new ContainerBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`-# page ${safePage}/${totalPages}`,
			),
		),
	);
	return {
		ideaContainers,
		navButtons,
		ideas,
		safePage,
		totalPages,
		wrapped,
	};
}

module.exports = {
	name: "view",
	parent: "idea",
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		let ideastuff = await makeIdeaStuff(1, message);
		function countComponents(components) {
			return components.reduce((sum, c) => {
				return sum + 1 + countComponents(c.components ?? []);
			}, 0);
		}

		const components = [...ideastuff.ideaContainers, ideastuff.navButtons];
		console.log("total components:", countComponents(components));
		const botMessage = await message.reply({
			flags: MessageFlags.IsComponentsV2,
			components: [...ideastuff.ideaContainers, ideastuff.navButtons],
		});
		const collector = botMessage.createMessageComponentCollector({
			idle: 60_000,
		});
		collector.on("collect", async (interaction) => {
			const [_, authorid, action, currentPage, ...args] =
				interaction.customId.split("_");
			let page = parseInt(currentPage);
			if (interaction.user.id != authorid)
				return interaction.reply({
					content: "this is not your command run your own command",
					flags: MessageFlags.Ephemeral,
				});
			if (action == "changePage") {
				const [direcion, lastPage] = args;
				let newpage = page + (direcion % lastPage);
				if (newpage < 0) newpage = lastPage;
				page = newpage;
			}
			if (action == "upvote") {
				const [IdeaId] = args;
				await db.ideas.handleVote(interaction.user.id, IdeaId, 1);
			}
			if (action == "downvote") {
				const [IdeaId] = args;
				await db.ideas.handleVote(interaction.user.id, IdeaId, -1);
			}
			ideastuff = await makeIdeaStuff(page, message);
			interaction.update({
				flags: MessageFlags.IsComponentsV2,
				components: [...ideastuff.ideaContainers, ideastuff.navButtons],
			});
		});
		collector.on("end", async () => {
			for (const container of ideastuff.ideaContainers) {
				for (const component of container.components) {
					if (component instanceof ActionRowBuilder) {
						for (const button of component.components) {
							button.setDisabled(true);
						}
					}
				}
			}
			ideastuff.navButtons.components.forEach((b) => b.setDisabled(true));

			botMessage.edit({
				components: [...ideastuff.ideaContainers, ideastuff.navButtons],
			});
		});
	},
};
