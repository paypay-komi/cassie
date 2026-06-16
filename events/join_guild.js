const { Events, EmbedBuilder } = require("discord.js");
const { getLogger } = require("../lib/logger");
const { findAnnouncementChannel } = require("../lib/findAnnouncementChannel");

module.exports = {
	name: Events.GuildCreate,
	async execute(client, guild) {
		const log = getLogger("GuildJoin");
		// temp to fix
		
		const prisma = client.db.prisma;
		await prisma.guildSettings.upsert({
			where: { guildId: guild.id },
			update: {},
			create: {
				guildId: guild.id,
			},
		});

		// Try to match this join to a recent invite click
		try {
			const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
			const click = await prisma.inviteClick.findFirst({
				where: {
					guildId: null,
					createdAt: { gte: tenMinAgo },
				},
				orderBy: { createdAt: "desc" },
			});
			if (click) {
				await prisma.inviteClick.update({
					where: { id: click.id },
					data: { guildId: guild.id, matchedAt: new Date() },
				});
				log.info(`Matched invite click ${click.id} (ref: ${click.ref}) to guild ${guild.id}`);
			}
		} catch (err) {
			log.warn(`Failed to match invite click: ${err.message}`);
		}

		// ── Announcement channel setup ──
		try {
			const existing = await client.db.announcements.get(guild.id);
			const prefix = await client.db.guild.getPrefix(guild.id);
			if (!existing.channelId && !existing.optedOut) {
				const channel = findAnnouncementChannel(guild);
				if (channel) {
					await channel.send({
						content:
							`👋 **Thanks for adding ${client.user.username}!**\n\n` +
							`I send important updates here. Want a different channel?\n` +
							`Run \`${prefix}subscribe #channel\` to pick where announcements go.\n` +
							`Don't want updates? Run \`${prefix}unsubscribe\` to opt out.`,
						allowedMentions: { parse: [] },
					});
				}
			}
		} catch (err) {
			log.warn(`Announcement nag failed for ${guild.id}: ${err.message}`);
		}

		// Only DM owners from shard 0 to prevent duplicate DMs
		if (client.shard && client.shard.ids[0] !== 0) return;

		log.info(`Joined guild: ${guild.name} (${guild.id})`);

		// DM all bot owners
		if (!client.owners?.length) return;

		const owner = await guild.fetchOwner().catch(() => null);

		const embed = new EmbedBuilder()
			.setTitle("Joined a Server")
			.setColor(0x57f287)
			.setThumbnail(guild.iconURL())
			.addFields(
				{ name: "Name", value: guild.name, inline: true },
				{ name: "ID", value: guild.id, inline: true },
				{
					name: "Members",
					value: guild.memberCount.toLocaleString(),
					inline: true,
				},
				{
					name: "Owner",
					value: owner
						? `${owner.user.tag} (${owner.id})`
						: "Unknown",
					inline: false,
				},
			)
			.setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
			.setTimestamp();

		for (const ownerId of client.owners) {
			const user = await client.users.fetch(ownerId).catch(() => null);
			if (user) user.send({ embeds: [embed] }).catch(() => {});
		}
	},
};
