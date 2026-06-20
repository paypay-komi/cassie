const {
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require("discord.js");
const { handleActionCommand } = require("./actionCommandHandler");

const ACTIONS_PER_PAGE = 25;

/**
 * Get all action names sorted alphabetically from the loaded text command tree.
 */
function getAllActionNames(client) {
	const actionCmd = client.textCommands?.get("action");
	if (!actionCmd?.subcommands) return [];
	return Object.values(actionCmd.subcommands)
		.filter(
			(cmd) =>
				cmd.parentRef === actionCmd &&
				typeof cmd.execute === "function" &&
				cmd.name !== "submit",
		)
		.map((cmd) => cmd.name)
		.sort();
}

/**
 * Build the paginated select menu + navigation buttons for a given page.
 */
function buildPage(targetUserId, page, actions) {
	const start = page * ACTIONS_PER_PAGE;
	const pageActions = actions.slice(start, start + ACTIONS_PER_PAGE);
	const totalPages = Math.ceil(actions.length / ACTIONS_PER_PAGE);

	const select = new StringSelectMenuBuilder()
		.setCustomId(`action_pick_${targetUserId}`)
		.setPlaceholder(
			`Actions (page ${page + 1}/${totalPages}, ${actions.length} total)`,
		)
		.setMinValues(1)
		.setMaxValues(1)
		.addOptions(
			pageActions.map((name) => ({
				label: name.charAt(0).toUpperCase() + name.slice(1),
				value: name,
				description: `Perform ${name} on the selected user`,
			})),
		);

	const rows = [new ActionRowBuilder().addComponents(select)];

	// Pagination buttons (only show both or one as needed)
	const navRow = new ActionRowBuilder();
	const prevBtn = new ButtonBuilder()
		.setCustomId(`action_page_${page - 1}_${targetUserId}`)
		.setLabel("◀ Previous")
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(page === 0);

	const nextBtn = new ButtonBuilder()
		.setCustomId(`action_page_${page + 1}_${targetUserId}`)
		.setLabel("Next ▶")
		.setStyle(ButtonStyle.Secondary)
		.setDisabled(page >= totalPages - 1);

	navRow.addComponents(prevBtn, nextBtn);
	rows.push(navRow);

	return { components: rows, totalPages, currentPage: page };
}

/**
 * Handle the initial user context menu interaction.
 * Shows the paginated action picker ephemerally.
 */
async function handleActionContextMenu(interaction, client) {
	const targetUserId = interaction.targetUser.id;
	const actions = getAllActionNames(client);

	if (actions.length === 0) {
		return interaction.reply({
			content: "No action commands available.",
			ephemeral: true,
		});
	}

	const { components } = buildPage(targetUserId, 0, actions);

	await interaction.reply({
		content: `Pick an action for <@${targetUserId}>:`,
		components,
		ephemeral: true,
	});
}

/**
 * Handle a select menu pick (user chose an action from the menu).
 */
async function handleActionPick(interaction, client) {
	const targetUserId = interaction.customId.replace("action_pick_", "");
	const actionName = interaction.values[0];

	const actionCmd =
		client.textCommands?.get("action")?.subcommands?.[actionName];
	if (!actionCmd) {
		return interaction.update({
			content: "That action is no longer available.",
			components: [],
		});
	}

	// Update the ephemeral message to show what was picked
	await interaction.update({
		content: `✅ ${actionName} on <@${targetUserId}>`,
		components: [],
	});

	// Build a fake message so handleActionCommand works
	const fakeMessage = {
		author: interaction.user,
		member: interaction.member,
		channel: interaction.channel,
		guild: interaction.guild,
		client,
		reply: (content) =>
			interaction.followUp({ content, ephemeral: true }),
	};

	const args = [`<@${targetUserId}>`];

	try {
		await actionCmd.execute(fakeMessage, args);
	} catch (err) {
		console.error(`Error executing user command action "${actionName}":`, err);
		await interaction.followUp({
			content: "There was an error executing that action.",
			ephemeral: true,
		});
	}
}

/**
 * Handle page navigation button clicks.
 */
async function handleActionPage(interaction, client) {
	// Format: action_page_<page>_<targetUserId>
	const parts = interaction.customId.split("_");
	const page = parseInt(parts[2], 10);
	const targetUserId = parts.slice(3).join("_");

	const actions = getAllActionNames(client);
	if (actions.length === 0 || isNaN(page)) {
		return interaction.update({
			content: "No actions available.",
			components: [],
		});
	}

	const { components } = buildPage(targetUserId, page, actions);

	await interaction.update({
		content: `Pick an action for <@${targetUserId}>:`,
		components,
	});
}

module.exports = {
	handleActionContextMenu,
	handleActionPick,
	handleActionPage,
};
