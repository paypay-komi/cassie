const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {
	commandId: "4d5e6f70-8b9c-4d3e-9f50-6a7b8c9d0e1f",
	name: "role",
	description: "Set the role applied to boosters",
	parent: "boost",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	args: ArgsBuilder.create().role("role", {
		required: true,
		description: "Role to apply to boosters",
	}),

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const roleId = args[0] ? args[0].replace(/[<@&>]/g, "") : null;
		const role = roleId ? guild.roles.cache.get(roleId) : null;

		if (!role) {
			return message.reply({
				components: [
					new ContainerBuilder()
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`## ❌ Invalid Role\nPlease mention a role, e.g. \`c.boost role @Booster\`.`,
							),
						)
						.setAccentColor(0xed4245),
				],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		if (role.managed) {
			return message.reply({
				components: [
					new ContainerBuilder()
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`## ❌ Managed Role\nI can't manually assign **${role.name}** because it's controlled by Discord or another integration.\n\nPlease choose a regular role instead.`,
							),
						)
						.setAccentColor(0xed4245),
				],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		const botMember = await guild.members.fetchMe().catch(() => null);
		if (botMember && role.position >= botMember.roles.highest.position) {
			return message.reply({
				components: [
					new ContainerBuilder()
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`## ❌ Role Too High\nI can't assign **${role.name}** because it's higher than (or equal to) my highest role.\n\nMove my highest role above it in **Server Settings → Roles**.`,
							),
						)
						.setAccentColor(0xed4245),
				],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		await prisma.guildBoostConfig.upsert({
			where: { guildId: guild.id },
			update: { roleId: role.id },
			create: { guildId: guild.id, roleId: role.id },
		});

		return message.reply({
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							`## ✅ Booster Role Set\nBoosters will now be given **${role.name}** automatically.\n\nRemove it later with \`c.boost clear role\`.`,
						),
					)
					.setAccentColor(0x57f287),
			],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	},
};