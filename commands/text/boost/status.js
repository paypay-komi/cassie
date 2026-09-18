const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");

module.exports = {
	commandId: "2b3c4d5e-6f7a-4b2c-8d3e-4f5a6b7c8d9e",
	name: "status",
	description: "Show the current boost thank-you configuration",
	parent: "boost",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;

		const config = await prisma.guildBoostConfig
			.findUnique({ where: { guildId: guild.id } })
			.catch(() => null);

		const channel = config?.channelId
			? guild.channels.cache.get(config.channelId)
			: null;
		const role = config?.roleId
			? guild.roles.cache.get(config.roleId)
			: null;

		const active = Boolean(config?.enabled && config.channelId);

		const lines = [
			`**Status:** ${active ? "🟢 Active" : "🔴 Inactive"}`,
			"",
			`**Thank-you channel:** ${
				channel ? `${channel}` : "Not set (boosters see nothing)"
			}`,
			`**Booster role:** ${
				role ? `${role}` : "Not set (no role applied)"
			}`,
			"",
			"**Setup:**",
			`\`c.boost channel #channel\` — where thank-you messages go`,
			`\`c.boost role @Role\` — role applied to boosters`,
			`\`c.boost clear channel|role|all\` — remove a setting`,
		];

		// Top boosters by streak
		const streaks = await prisma.memberBoostStreak
			.findMany({
				where: { guildId: guild.id },
				orderBy: [{ totalBoosts: "desc" }, { streak: "desc" }],
				take: 5,
			})
			.catch(() => []);

		if (streaks.length > 0) {
			const entries = [];
			for (const s of streaks) {
				const member = await guild.members
					.fetch(s.userId)
					.catch(() => null);
				entries.push(
					`${member ? member.user.displayName : s.userId} — 🔥 ${s.streak} streak · ⭐ ${s.totalBoosts} total`,
				);
			}
			lines.push("", "**Top Boosters:**", ...entries);
		}

		if (!active) {
			lines.push(
				"",
				"-# Boost thank-yous are off. Set a channel with `c.boost channel #channel` to turn them on.",
			);
		}

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`## 💜 Boost Thanks\n${lines.join("\n")}`,
				),
			)
			.setAccentColor(0xf47fff);

		return message.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	},
};