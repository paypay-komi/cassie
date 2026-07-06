const {
	PermissionsBitField,
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
const db = require("../../../db");
const actionUserCommand = require("../../../utils/actionUserCommand");
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
		const maxPreviewLength = 1024;
		const content =
			idea.content.length > maxPreviewLength
				? idea.content.slice(0, maxPreviewLength - 3) + "..."
				: idea.content;
		const userVote = idea.votes?.find((v) => v.userId === userId);
		const userUpvoted = userVote?.value === 1;
		const userDownvoted = userVote?.value === -1;

		const container = new ContainerBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`**Idea #${(safePage - 1) * 7 + i + 1}** votes: ${idea.vote_score}\n${content}`,
			),
		);
		const actionRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(
					`ideaViewer_${userId}_upvote_${safePage}_${idea.id}`,
				)
				.setLabel("👍")
				.setStyle(
					userUpvoted ? ButtonStyle.Success : ButtonStyle.Secondary,
				),
			new ButtonBuilder()
				.setCustomId(
					`ideaViewer_${userId}_downvote_${safePage}_${idea.id}`,
				)
				.setLabel("👎")
				.setStyle(
					userDownvoted ? ButtonStyle.Danger : ButtonStyle.Secondary,
				),
		);
		if (idea.content.length > maxPreviewLength) {
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId(
						`ideaViewer_${userId}_viewFull_${safePage}_${idea.id}`,
					)
					.setLabel("View full idea")
					.setStyle(ButtonStyle.Secondary),
			);
		}
		container.addActionRowComponents(actionRow);
		return container;
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
	commandId: "f200ef06-ef2c-4124-bbb6-17703f3da8fa",
	name: "view",
	description: "Browse and vote on submitted ideas",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
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
			if (action == "viewFull") {
				const [IdeaId] = args;
				const idea = await db.prisma.idea.findUnique({
					where: { id: IdeaId },
				});
				const container =
					new ContainerBuilder().addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							`# Idea ${IdeaId}\n ${idea.content}`,
						),
					);
				const actionRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder()
						.setCustomId(`ideaViewer_${authorid}_back_${page}`)
						.setLabel("Back To Ideas")
						.setStyle(ButtonStyle.Danger),
				);
				return interaction.update({
					flags: MessageFlags.IsComponentsV2,
					components: [container, actionRow],
				});
			}
			if (action == "back") {
				// theroeticly i shouldnt have to do anything as it will just make the embed with the page and go back to where it was below
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
