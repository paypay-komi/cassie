const { getLogger } = require("./logger");

const log = getLogger("Moderation");

async function nextCaseNumber(prisma, guildId) {
	const agg = await prisma.moderationCase.aggregate({
		where: { guildId },
		_max: { caseNumber: true },
	});
	return (agg._max.caseNumber ?? 0) + 1;
}

async function createCase({
	prisma,
	guildId,
	moderatorId,
	targetId,
	type,
	reason = "No reason provided",
	duration = null,
}) {
	const caseNumber = await nextCaseNumber(prisma, guildId);
	return prisma.moderationCase.create({
		data: { guildId, caseNumber, moderatorId, targetId, type, reason, duration },
	});
}

function formatDuration(seconds) {
	if (!seconds) return "N/A";
	const units = [
		["year", 31536000],
		["month", 2592000],
		["week", 604800],
		["day", 86400],
		["hour", 3600],
		["minute", 60],
		["second", 1],
	];
	const parts = [];
	let s = seconds;
	for (const [name, size] of units) {
		const v = Math.floor(s / size);
		if (v > 0) {
			parts.push(`${v} ${name}${v > 1 ? "s" : ""}`);
			s -= v * size;
		}
	}
	return parts.slice(0, 3).join(", ") || "0s";
}

function parseDuration(text) {
	if (!text) return null;
	const matches = String(text).match(/(\d+)\s*(s|m|h|d|w|mo|y)/gi);
	if (!matches) return null;
	const mult = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, mo: 2592000, y: 31536000 };
	let total = 0;
	for (const part of matches) {
		const m = part.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
		if (!m) continue;
		total += parseInt(m[1], 10) * mult[m[2].toLowerCase()];
	}
	return total;
}

function renderTemplate(template, vars) {
	return template
		.replaceAll("{user.tag}", vars.userTag ?? vars.user ?? "")
		.replaceAll("{user}", vars.user ?? "")
		.replaceAll("{moderator}", vars.moderator ?? "Unknown")
		.replaceAll("{guild}", vars.guild ?? "")
		.replaceAll("{reason}", vars.reason ?? "No reason provided")
		.replaceAll("{duration}", vars.duration ?? "N/A")
		.replaceAll("{case}", vars.caseNumber ? `#${vars.caseNumber}` : "#?")
		.replaceAll("{channel}", vars.channel ?? "");
}

/**
 * Send configured invoke messages (DM and/or mod channel) for a moderation action.
 */
async function sendInvoke(client, guild, { command, moderator, targetUser, reason, duration, caseNumber, channel }) {
	const prisma = client.db.prisma;
	const configs = await prisma.invokeConfig
		.findMany({ where: { guildId: guild.id, command } })
		.catch(() => []);

	const vars = {
		user: `<@${targetUser.id}>`,
		userTag: targetUser.tag,
		moderator: moderator ? `<@${moderator.id}>` : "Unknown",
		guild: guild.name,
		reason: reason || "No reason provided",
		duration: formatDuration(duration),
		caseNumber,
		channel: channel ? `<#${channel.id}>` : "",
	};

	for (const cfg of configs) {
		const content = renderTemplate(cfg.content, vars);

		if (cfg.type === "dm") {
			try {
				await targetUser.send({ content, allowedMentions: { parse: [] } });
				await prisma.moderationLog
					.create({
						data: {
							guildId: guild.id,
							caseId: caseNumber ? String(caseNumber) : "",
							type: "dm_sent",
							content,
						},
					})
					.catch(() => {});
			} catch (err) {
				await prisma.moderationLog
					.create({
						data: {
							guildId: guild.id,
							caseId: caseNumber ? String(caseNumber) : "",
							type: "dm_failed",
							content: err.message,
						},
					})
					.catch(() => {});
			}
		} else if (cfg.type === "message") {
			if (channel && channel.isTextBased()) {
				await channel.send({ content, allowedMentions: { parse: [] } }).catch(() => {});
			}
		}
	}
}

async function applyRole(guild, member, roleId, label) {
	if (!roleId) return null;
	const role = guild.roles.cache.get(roleId);
	if (!role) return null;
	const me = guild.members.me;
	if (role.managed || (me && role.position >= me.roles.highest.position)) return null;
	try {
		await member.roles.add(roleId, label);
		return role;
	} catch (err) {
		log.warn(`${label} role add failed: ${err.message}`);
		return null;
	}
}

async function removeRole(guild, member, roleId, label) {
	if (!roleId) return;
	try {
		await member.roles.remove(roleId, label);
	} catch (err) {
		log.warn(`${label} role remove failed: ${err.message}`);
	}
}

async function warnCount(prisma, guildId, userId) {
	return prisma.moderationCase.count({
		where: { guildId, targetId: userId, type: "warn" },
	});
}

/** Apply the first matching warn-punishment threshold. */
async function escalateWarn(client, guild, member, reason) {
	const prisma = client.db.prisma;
	const count = await warnCount(prisma, guild.id, member.id).catch(() => 0);
	if (!count) return null;

	const thresholds = await prisma.warnPunishment
		.findMany({ where: { guildId: guild.id } })
		.catch(() => []);
	const applicable = thresholds
		.filter((t) => t.threshold <= count)
		.sort((a, b) => b.threshold - a.threshold);
	if (!applicable.length) return null;

	const punish = applicable[0];
	const base = { prisma, guildId: guild.id, moderatorId: client.user.id, targetId: member.id, reason: `Auto ${punish.action} after ${count} warns ${reason ? `· ${reason}` : ""}` };
	const jailCfg = await prisma.jailConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);

	switch (punish.action) {
		case "timeout":
			if (punish.duration) await member.timeout(punish.duration * 1000, `Escalation (${count} warns)`).catch(() => {});
			await createCase({ ...base, type: "timeout", duration: punish.duration });
			break;
		case "kick":
			await member.kick(`Escalation (${count} warns)`).catch(() => {});
			await createCase({ ...base, type: "kick" });
			break;
		case "jail":
			if (jailCfg?.roleId) await applyRole(guild, member, jailCfg.roleId, "Escalation jail");
			await createCase({ ...base, type: "jail" });
			break;
		case "softban":
			await member.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason: `Softban escalation (${count} warns)` }).catch(() => {});
			await guild.members.unban(member.id, "Softban complete").catch(() => {});
			await createCase({ ...base, type: "softban" });
			break;
		case "hardban":
			await member.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason: `Hardban escalation (${count} warns)` }).catch(() => {});
			await createCase({ ...base, type: "hardban" });
			break;
		case "ban":
			await member.ban({ reason: `Ban escalation (${count} warns)` }).catch(() => {});
			await createCase({ ...base, type: "ban" });
			break;
	}
	return punish;
}

module.exports = {
	nextCaseNumber,
	createCase,
	formatDuration,
	parseDuration,
	renderTemplate,
	sendInvoke,
	applyRole,
	removeRole,
	warnCount,
	escalateWarn,
};