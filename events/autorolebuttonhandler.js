const {
	Events,
	Client,
	Interaction,
	MessageFlags,
	PermissionsBitField,
} = require("discord.js");

const { getLogger } = require("../lib/logger");
const db = require("../db");

const {
	parseExpression,
	RequirementParseError,
} = require("../lib/roleRequirementEvaluator");

const log = getLogger("autorole merge handler");

module.exports = {
	name: Events.InteractionCreate,
	description: "handles autorole merge buttons",

	/**
	 * @param {Client} client
	 * @param {Interaction} interaction
	 */
	async execute(client, interaction) {
		if (!interaction.isButton()) return;
		if (!interaction.customId.startsWith("autorole_merge:")) return;

		const [, action, guildId, roleId] = interaction.customId.split(":");

		if (interaction.guildId !== guildId) {
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "this button is not for this server",
			});
		}

		const member = await interaction.guild.members.fetch(
			interaction.user.id,
		);

		if (!member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "you need the Manage Roles permission to do this",
			});
		}

		// Cancel doesn't need to touch the database.
		if (action === "cancel") {
			return interaction.update({
				content: "Autorole configuration cancelled.",
				components: [],
			});
		}

		const autorole = await db.prisma.guildMemberRoleRequirement.findUnique({
			where: {
				guildId_roleId: {
					guildId,
					roleId,
				},
			},
		});

		if (!autorole) {
			log.warn(`invalid autorole ${guildId}:${roleId}`);

			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "this autorole no longer exists",
			});
		}

		/*
		 * The create command displays the new expression in the
		 * Components V2 message, so pull it from the message.
		 */
		const text = interaction.message.components
			.flatMap((component) => component.components ?? [])
			.map((component) => component.content ?? "")
			.join("\n");

		const match = text.match(/\*\*New requirement\*\*\s*`([^`]+)`/);

		if (!match) {
			log.error(
				`could not find new requirement for autorole ${guildId}:${roleId}`,
			);

			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"I couldn't find the new requirement. Please run the command again.",
			});
		}

		const newExpression = match[1];

		let expression;

		switch (action) {
			case "replace":
				expression = newExpression;
				break;

			case "or":
				expression = `(${autorole.expression}) OR (${newExpression})`;
				break;

			case "and":
				expression = `(${autorole.expression}) AND (${newExpression})`;
				break;

			default:
				log.warn(`invalid autorole merge action: ${action}`);

				return interaction.reply({
					flags: MessageFlags.Ephemeral,
					content: "invalid autorole action",
				});
		}

		let ast;

		try {
			ast = parseExpression(expression);
		} catch (error) {
			if (error instanceof RequirementParseError) {
				return interaction.reply({
					flags: MessageFlags.Ephemeral,
					content: error.userMessage,
				});
			}

			log.error(
				"unexpected error while parsing autorole expression",
				error,
			);

			return interaction.reply({
				flags: MessageFlags.Ephemeral,
				content:
					"Something went wrong while processing that requirement.",
			});
		}

		await db.prisma.guildMemberRoleRequirement.update({
			where: {
				guildId_roleId: {
					guildId,
					roleId,
				},
			},
			data: {
				expression,
				ast,
			},
		});

		const role = await interaction.guild.roles
			.fetch(roleId)
			.catch(() => null);

		if (!role) {
			return interaction.update({
				content: "Autorole updated, but I couldn't find the role.",
				components: [],
			});
		}

		return interaction.update({
			content:
				`Auto role ${role} updated successfully!\n\n` +
				`**Requirement:** \`${expression}\``,
			components: [],
		});
	},
};
