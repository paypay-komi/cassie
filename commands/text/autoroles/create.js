const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require("discord.js");
const { getLogger } = require("../../../lib/logger.js");
const log = getLogger("autoroles:create");
const {
	parseExpression,
	RequirementParseError,
} = require("../../../lib/roleRequirementEvaluator.js");

const prisma = require("../../../db/index.js").prisma;

module.exports = {
	commandId: "e166ddea-6693-4cb0-b60b-c65f9d3b8469",
	name: "create",
	description: "creates a new auto role",

	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.ManageRoles,
	],

	requiredUserPermissions: [PermissionsBitField.Flags.ManageRoles],

	parent: "autorole",
	aliases: ["make", "add", "new"],

	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const roleInput = args.shift();

		if (!roleInput) {
			return message.reply(
				"the first argument must be a role name, id, or mention",
			);
		}

		const roles = await message.guild.roles.fetch();

		const roleId = roleInput.match(/^<@&(\d+)>$/)?.[1];

		const role =
			(roleId && roles.get(roleId)) ||
			roles.get(roleInput) ||
			roles.find(
				(role) => role.name.toLowerCase() === roleInput.toLowerCase(),
			);

		if (!role) {
			return message.reply(
				`I couldn't find a role with the name, id, or mention \`${roleInput}\``,
			);
		}

		if (role.managed) {
			return message.reply(
				`I can't assign ${role} because it's a **managed role**.\n\n` +
					`Managed roles are controlled by Discord or another integration, so bots can't manually assign or remove them.\n\n` +
					`Please choose a regular role instead!`,
			);
		}

		const botMember = await message.guild.members.fetchMe();

		if (role.position >= botMember.roles.highest.position) {
			return message.reply(
				`I can't assign the ${role} role because it's higher than or equal to my highest role.\n\n` +
					`**To fix this:**\n` +
					`Move my highest role above ${role} **or** move ${role} below my highest role in **Server Settings → Roles**.`,
			);
		}

		const expression = args.join(" ");

		if (!expression?.trim()) {
			return message.reply(
				"You need to provide a requirement expression.\n\n" +
					"**Available requirements:**\n" +
					"`messageCount` — number of messages sent\n" +
					"`voiceSeconds` — time spent in voice chat, in seconds\n" +
					"`daysInServer` — number of days the member has been in the server\n\n" +
					"**Operators:**\n" +
					"`>=` greater than or equal to\n" +
					"`<=` less than or equal to\n" +
					"`>` greater than\n" +
					"`<` less than\n" +
					"`==` exactly equal to\n\n" +
					"**You can combine requirements with:**\n" +
					"`AND` — all requirements must be met\n" +
					"`OR` — at least one requirement must be met\n\n" +
					"**Examples:**\n" +
					"`messageCount >= 100`\n" +
					"`voiceSeconds >= 7200`\n" +
					"`daysInServer >= 30`\n" +
					"`messageCount >= 500 AND voiceSeconds >= 7200`\n" +
					"`messageCount >= 1000 OR daysInServer >= 30`\n\n" +
					"Don't want to write the expression yourself? You can use `c.chat` " +
					"to help create one.",
			);
		}

		let ast;

		try {
			ast = parseExpression(expression);
		} catch (error) {
			if (error instanceof RequirementParseError) {
				return message.reply(error.userMessage);
			}

			log.error(
				"Unexpected error while parsing autorole requirement:",
				error,
			);

			return message.reply(
				"Something went wrong while processing that requirement. Please try again later.",
			);
		}

		try {
			await prisma.guildMemberRoleRequirement.create({
				data: {
					guildId: message.guild.id,
					roleId: role.id,
					expression,
					ast,
				},
			});

			return message.reply({
				content: `Auto role ${role} created successfully!\n\n**Requirement:** \`${expression}\``,
			});
		} catch (error) {
			if (error?.code !== "P2002") {
				log.error(
					"Unexpected error while creating autorole requirement:",
					error,
				);

				return message.reply(
					"Something went wrong while creating that autorole. Please try again later.",
				);
			}
		}

		const existing = await prisma.guildMemberRoleRequirement.findUnique({
			where: {
				guildId_roleId: {
					guildId: message.guild.id,
					roleId: role.id,
				},
			},
		});

		if (!existing) {
			return message.reply(
				"That autorole already exists, but I couldn't retrieve its current requirement.",
			);
		}

		const container = new ContainerBuilder().addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`## Autorole Already Configured\n\n` +
					`${role} already has a requirement configured.\n\n` +
					`**Current requirement**\n` +
					`\`${existing.expression}\`\n\n` +
					`**New requirement**\n` +
					`\`${expression}\`\n\n` +
					`What would you like to do?`,
			),
		);

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(
					`autorole_merge:replace:${message.guild.id}:${role.id}`,
				)
				.setLabel("Replace")
				.setStyle(ButtonStyle.Primary),

			new ButtonBuilder()
				.setCustomId(`autorole_merge:or:${message.guild.id}:${role.id}`)
				.setLabel("Merge with OR")
				.setStyle(ButtonStyle.Success),

			new ButtonBuilder()
				.setCustomId(
					`autorole_merge:and:${message.guild.id}:${role.id}`,
				)
				.setLabel("Merge with AND")
				.setStyle(ButtonStyle.Secondary),

			new ButtonBuilder()
				.setCustomId(
					`autorole_merge:cancel:${message.guild.id}:${role.id}`,
				)
				.setLabel("Cancel")
				.setStyle(ButtonStyle.Danger),
		);

		container.addActionRowComponents(row);

		return message.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	},
};
