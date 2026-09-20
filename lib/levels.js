const { getLogger } = require("./logger");

const log = getLogger("Levels");

const XP_MIN = 15;
const XP_MAX = 25;
const COOLDOWN_MS = 60 * 1000;

/** XP required to go from `level` to `level + 1`. */
function xpToNext(level) {
	return 5 * level * level + 50 * level + 100;
}

/** Cumulative XP required to reach `level` from zero. */
function totalXpForLevel(level) {
	let total = 0;
	for (let i = 0; i < level; i++) total += xpToNext(i);
	return total;
}

/** Resolve a total XP amount into level + progress within the level. */
function levelFromXp(totalXp) {
	let remaining = Number(totalXp);
	let level = 0;
	while (remaining >= xpToNext(level)) {
		remaining -= xpToNext(level);
		level++;
	}
	return { level, current: remaining, needed: xpToNext(level) };
}

function progressBar(current, needed, size = 12) {
	const ratio = needed > 0 ? Math.min(1, current / needed) : 0;
	const filled = Math.round(ratio * size);
	return "▰".repeat(filled) + "▱".repeat(size - filled);
}

async function getConfig(prisma, guildId) {
	return prisma.levelConfig.upsert({
		where: { guildId },
		update: {},
		create: { guildId },
	});
}

async function getMember(prisma, guildId, userId) {
	return prisma.memberXP.upsert({
		where: { guildId_userId: { guildId, userId } },
		update: {},
		create: { guildId, userId },
	});
}

async function isIgnored(prisma, guildId, member, channelId) {
	const rows = await prisma.levelIgnore.findMany({ where: { guildId } });
	for (const r of rows) {
		if (r.targetType === "channel" && r.targetId === channelId) return true;
		if (r.targetType === "role" && member.roles?.cache?.has(r.targetId))
			return true;
	}
	return false;
}

async function multiplierFor(prisma, guildId, member, channelId) {
	let mult = 1;
	const rows = await prisma.levelMultiplier.findMany({ where: { guildId } });
	for (const r of rows) {
		if (r.targetType === "role" && member.roles?.cache?.has(r.targetId))
			mult *= r.multiplier;
		else if (r.targetType === "channel" && r.targetId === channelId)
			mult *= r.multiplier;
	}
	return mult;
}

async function addXp(prisma, guildId, userId, amount) {
	const m = await getMember(prisma, guildId, userId);
	const before = levelFromXp(m.xp);
	const newXp = m.xp + BigInt(Math.max(0, Math.floor(amount)));
	const after = levelFromXp(newXp);

	const member = await prisma.memberXP.update({
		where: { guildId_userId: { guildId, userId } },
		data: {
			xp: newXp,
			level: after.level,
			lastMessageAt: new Date(),
		},
	});

	return { member, before, after, leveledUp: after.level > before.level };
}

async function addVoiceXp(prisma, guildId, userId, seconds, amount) {
	const m = await getMember(prisma, guildId, userId);
	const before = levelFromXp(m.xp);
	const newXp = m.xp + BigInt(Math.max(0, Math.floor(amount)));
	const after = levelFromXp(newXp);

	const member = await prisma.memberXP.update({
		where: { guildId_userId: { guildId, userId } },
		data: {
			xp: newXp,
			level: after.level,
			totalVoiceSec: { increment: BigInt(Math.max(0, Math.floor(seconds))) },
			lastVoiceAt: new Date(),
		},
	});

	return { member, before, after, leveledUp: after.level > before.level };
}

/** Assign reward roles, milestone coins and announcements on level-up. */
async function handleLevelUp(client, guild, member, config, newLevel) {
	const prisma = client.db.prisma;

	// Role rewards
	try {
		const rewards = await prisma.levelRoleReward.findMany({
			where: { guildId: guild.id },
		});
		const applicable = rewards
			.filter((r) => r.level <= newLevel)
			.sort((a, b) => a.level - b.level);
		if (applicable.length) {
			const highest = applicable[applicable.length - 1];
			if (!config.stackRoles) {
				for (const r of applicable.slice(0, -1)) {
					if (member.roles.cache.has(r.roleId)) {
						await member.roles.remove(r.roleId).catch(() => {});
					}
				}
			}
			const role = guild.roles.cache.get(highest.roleId);
			const me = guild.members.me;
			if (
				role &&
				!role.managed &&
				me &&
				role.position < me.roles.highest.position
			) {
				await member.roles.add(highest.roleId).catch(() => {});
			}
		}
	} catch (err) {
		log.warn(`Role reward failed: ${err.message}`);
	}

	// Milestones (coins + optional role)
	try {
		const milestones = await prisma.levelMilestone.findMany({
			where: { guildId: guild.id, level: newLevel },
		});
		for (const m of milestones) {
			if (m.coins) {
				await client.db.economy
					.addBalance(
						guild.id,
						member.id,
						m.coins,
						"level_milestone",
						`Reached level ${newLevel}`,
					)
					.catch(() => {});
			}
			if (m.roleId) {
				await member.roles.add(m.roleId).catch(() => {});
			}
		}
	} catch (err) {
		log.warn(`Milestone failed: ${err.message}`);
	}

	// Announcement
	if (config.channelId) {
		const ch = guild.channels.cache.get(config.channelId);
		if (ch && ch.isTextBased()) {
			await ch
				.send({
					content: `🎉 ${member} reached **level ${newLevel}**!`,
					allowedMentions: { users: [member.id] },
				})
				.catch(() => {});
		}
	}

	if (config.dmLevelUp) {
		await member
			.send(`You reached **level ${newLevel}** in **${guild.name}**!`)
			.catch(() => {});
	}
}

module.exports = {
	XP_MIN,
	XP_MAX,
	COOLDOWN_MS,
	xpToNext,
	totalXpForLevel,
	levelFromXp,
	progressBar,
	getConfig,
	getMember,
	isIgnored,
	multiplierFor,
	addXp,
	addVoiceXp,
	handleLevelUp,
};
