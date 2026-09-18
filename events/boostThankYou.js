const { Events, EmbedBuilder } = require("discord.js");
const { getLogger } = require("../lib/logger");

const log = getLogger("Boosts");

const BOOST_COLOR = 0xf47fff; // Discord boost pink
const STREAK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function updateStreak(prisma, guildId, userId) {
	const existing = await prisma.memberBoostStreak.findUnique({
		where: { guildId_userId: { guildId, userId } },
	});

	if (!existing) {
		return prisma.memberBoostStreak.create({
			data: {
				guildId,
				userId,
				streak: 1,
				totalBoosts: 1,
				lastBoostAt: new Date(),
			},
		});
	}

	const isConsecutive =
		existing.lastBoostAt &&
		Date.now() - existing.lastBoostAt.getTime() <= STREAK_WINDOW_MS;

	return prisma.memberBoostStreak.update({
		where: { guildId_userId: { guildId, userId } },
		data: {
			streak: isConsecutive ? existing.streak + 1 : 1,
			totalBoosts: existing.totalBoosts + 1,
			lastBoostAt: new Date(),
		},
	});
}

async function applyBoostRole(newMember, roleId) {
	const role = newMember.guild.roles.cache.get(roleId);
	if (!role) return null;

	if (role.managed) {
		log.warn(
			`Skip managed boost role ${role.name} for ${newMember.user.id} (guild ${newMember.guild.id})`,
		);
		return null;
	}

	const botMember = await newMember.guild.members.fetchMe().catch(() => null);
	if (!botMember || role.position >= botMember.roles.highest.position) {
		log.warn(
			`Cannot assign boost role ${role.name}: role is higher than bot's highest role`,
		);
		return null;
	}

	try {
		await newMember.roles.add(roleId, "Boost thank-you role");
		return role;
	} catch (err) {
		log.warn(`Failed to assign boost role: ${err.message}`);
		return null;
	}
}

async function removeBoostRole(newMember, roleId) {
	if (!roleId) return;
	const role = newMember.guild.roles.cache.get(roleId);
	if (!role || role.managed) return;

	try {
		await newMember.roles.remove(roleId, "Stopped boosting");
	} catch (err) {
		log.warn(`Failed to remove boost role: ${err.message}`);
	}
}

module.exports = {
	name: Events.GuildMemberUpdate,
	async execute(client, oldMember, newMember) {
		if (!newMember?.guild) return;

		const guild = newMember.guild;
		const prisma = client.db?.prisma;

		if (!prisma) return;

		// ── Boost started (premiumSince null → set) ──
		if (!oldMember.premiumSince && newMember.premiumSince) {
			let config;
			try {
				config = await prisma.guildBoostConfig.findUnique({
					where: { guildId: guild.id },
				});
			} catch (err) {
				log.error(`Failed to load boost config: ${err.message}`);
				return;
			}

			if (!config || !config.enabled) return;

			// Track streak
			let streak = null;
			try {
				streak = await updateStreak(prisma, guild.id, newMember.user.id);
			} catch (err) {
				log.error(`Failed to update boost streak: ${err.message}`);
			}

			// Apply configured role
			if (config.roleId) {
				await applyBoostRole(newMember, config.roleId);
			}

			// Send thank-you message
			if (config.channelId) {
				const channel = guild.channels.cache.get(config.channelId);
				if (channel && channel.isTextBased()) {
					try {
						const embed = new EmbedBuilder()
							.setTitle("Thank You for Boosting! 💜")
							.setColor(BOOST_COLOR)
							.setThumbnail(
								newMember.user.displayAvatarURL({ size: 256 }),
							)
							.setDescription(
								`${newMember} just boosted **${guild.name}**!`,
							)
							.addFields(
								{
									name: "🔥 Boost Streak",
									value: `${streak ? streak.streak : 1} consecutive`,
									inline: true,
								},
								{
									name: "⭐ Total Boosts",
									value: `${streak ? streak.totalBoosts : 1}`,
									inline: true,
								},
								{
									name: "✨ Server Boosts",
									value: `${guild.premiumSubscriptionCount}`,
									inline: true,
								},
								...(config.roleId
									? [
											{
												name: "🎁 You Got a Role",
												value: `You've been given <@&${config.roleId}>`,
												inline: false,
											},
										]
									: []),
							)
							.setTimestamp()
							.setFooter({ text: client.user?.username || "Cassie" });

						await channel.send({
							embeds: [embed],
							allowedMentions: { users: [newMember.user.id] },
						});
					} catch (err) {
						log.error(
							`Failed to send boost thank-you: ${err.message}`,
						);
					}
				}
			}
		}

		// ── Boost removed (premiumSince set → null) ──
		else if (oldMember.premiumSince && !newMember.premiumSince) {
			let config;
			try {
				config = await prisma.guildBoostConfig.findUnique({
					where: { guildId: guild.id },
				});
			} catch (err) {
				log.error(`Failed to load boost config: ${err.message}`);
				return;
			}

			if (!config) return;

			if (config.roleId) {
				await removeBoostRole(newMember, config.roleId);
			}

			try {
				await prisma.memberBoostStreak.updateMany({
					where: { guildId: guild.id, userId: newMember.user.id },
					data: { streak: 0 },
				});
			} catch (err) {
				log.error(`Failed to reset boost streak: ${err.message}`);
			}
		}
	},
};