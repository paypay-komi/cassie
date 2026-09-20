const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");
const tracker = require("../lib/inviteTracker");

const log = getLogger("InviteTracker");

const DEFAULT_MESSAGE =
	"Welcome {user}! You were invited by {inviter} — they now have {invites} invite(s).";

module.exports = {
	name: Events.GuildMemberAdd,
	async execute(client, member) {
		if (!member?.guild || member.user.bot) return;

		const prisma = client.db.prisma;
		const guild = member.guild;

		let config = null;
		try {
			config = await prisma.guildInviteConfig.findUnique({
				where: { guildId: guild.id },
			});
		} catch (err) {
			log.warn(`Failed to load invite config for ${guild.id}: ${err.message}`);
		}

		if (config && config.trackingEnabled === false) return;

		const detected = await tracker.detect(client, guild);

		// Fake-account detection (account younger than configured days)
		const fakeDays = config?.fakeAccountDays ?? 0;
		const ageMs = Date.now() - member.user.createdTimestamp;
		const fake = fakeDays > 0 && ageMs < fakeDays * 24 * 60 * 60 * 1000;

		let inviteRow = null;
		if (detected.code && detected.inviterId) {
			try {
				inviteRow = await prisma.invite.upsert({
					where: {
						guildId_code: {
							guildId: guild.id,
							code: detected.code,
						},
					},
					update: { uses: { increment: 1 } },
					create: {
						guildId: guild.id,
						code: detected.code,
						inviterId: detected.inviterId,
						uses: 1,
					},
				});
			} catch (err) {
				log.warn(`Failed to record invite use: ${err.message}`);
			}
		}

		try {
			await prisma.inviteJoin.create({
				data: {
					guildId: guild.id,
					userId: member.id,
					inviteId: inviteRow?.id ?? null,
					fake,
				},
			});
		} catch (err) {
			log.warn(`Failed to record join for ${member.id}: ${err.message}`);
		}

		if (!config?.channelId) return;

		const channel = guild.channels.cache.get(config.channelId);
		if (!channel || !channel.isTextBased()) return;

		let invites = 0;
		if (detected.inviterId) {
			try {
				const inviterMember =
					guild.members.cache.get(detected.inviterId) || null;
				const stats = await tracker.getStats(
					prisma,
					guild.id,
					detected.inviterId,
					inviterMember,
				);
				invites = stats.total;
			} catch {
				/* ignore */
			}
		}

		const template = config.message || DEFAULT_MESSAGE;
		const content = tracker.renderMessage(template, {
			user: member.toString(),
			userTag: member.user.tag,
			inviter: detected.inviterId
				? `<@${detected.inviterId}>`
				: "Unknown",
			invites,
			guild: guild.name,
			code: detected.code ?? "unknown",
		});

		await channel
			.send({ content, allowedMentions: { users: [member.id] } })
			.catch((err) =>
				log.warn(`Failed to send invite announcement: ${err.message}`),
			);
	},
};
