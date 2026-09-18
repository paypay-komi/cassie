const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {
	commandId: "5e6f7081-9c0d-4e3f-8061-7b8c9d0e1f20",
	name: "clear",
	description: "Clear the boost channel and/or booster role",
	parent: "boost",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	args: ArgsBuilder.create().string("what", {
		required: true,
		description: "What to clear: channel, role, or all",
	}),

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const what = (args[0] || "").toLowerCase();

		if (!["channel", "role", "all"].includes(what)) {
			return message.reply({
				components: [
					new ContainerBuilder()
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`## ❌ Unknown Target\nUse \`c.boost clear channel\`, \`c.boost clear role\`, or \`c.boost clear all\`.`,
							),
						)
						.setAccentColor(0xed4245),
				],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		const config = await prisma.guildBoostConfig
			.findUnique({ where: { guildId: guild.id } })
			.catch(() => null);

		if (!config) {
			return message.reply({
				components: [
					new ContainerBuilder()
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent(
								`## Nothing to Clear\nBoost thanks aren't configured yet.\n\nSet it up with \`c.boost channel #channel\`.`,
							),
						)
						.setAccentColor(0xfee75c),
				],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		if (what === "channel" || what === "all") {
			await prisma.guildBoostConfig.update({
				where: { guildId: guild.id },
				data: { channelId: null },
			});
		}

		if (what === "role" || what === "all") {
			await prisma.guildBoostConfig.update({
				where: { guildId: guild.id },
				data: { roleId: null },
			});
		}

		return message.reply({
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							`## ✅ Cleared\n**${what === "all" ? "All boost settings" : `Boost ${what}`}** have been cleared.`,
						),
					)
					.setAccentColor(0x57f287),
			],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	},
};