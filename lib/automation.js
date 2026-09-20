const { getLogger } = require("./logger");

const log = getLogger("Automation");

// ---- Antinuke ----

async function getAntinukeConfig(prisma, guildId) {
	return prisma.antinukeConfig.findUnique({
		where: { guildId },
		include: { modules: true },
	});
}

async function ensureAntinukeConfig(prisma, guildId) {
	return prisma.antinukeConfig.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
		include: { modules: true },
	});
}

function isWhitelistedAntinuke(cfg, userId) {
	if (!cfg) return false;
	if (cfg.admins.includes(userId)) return true;
	if (cfg.whitelisted.includes(userId)) return true;
	return false;
}

function getModule(cfg, type) {
	if (!cfg || !cfg.modules) return null;
	return cfg.modules.find((m) => m.type === type) || null;
}

function isModuleEnabled(cfg, type) {
	const mod = getModule(cfg, type);
	return mod && mod.enabled;
}

async function punishAntinuke(client, guild, userId, mod) {
	const member = await guild.members.fetch(userId).catch(() => null);
	if (!member) return;

	const action = mod.punishment;
	const reason = "Antinuke automated punishment";

	try {
		if (action === "ban") {
			await member.ban({ reason, deleteMessageSeconds: 0 });
		} else if (action === "kick") {
			await member.kick(reason);
		} else if (action === "timeout") {
			await member.timeout((mod.punishmentDuration || 3600) * 1000, reason);
		} else if (action === "strip") {
			const me = guild.members.me;
			const roles = member.roles.cache
				.filter((r) => r.id !== guild.id && me && r.position < me.roles.highest.position)
				.map((r) => r.id);
			if (roles.length) await member.roles.remove(roles, reason);
		}
	} catch (err) {
		log.warn("Punish failed: " + err.message);
	}
}

// ---- Antiraid ----

async function getAntiraidConfig(prisma, guildId) {
	return prisma.antiraidConfig.findUnique({
		where: { guildId },
		include: { modules: true },
	});
}

async function ensureAntiraidConfig(prisma, guildId) {
	return prisma.antiraidConfig.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
		include: { modules: true },
	});
}

function isWhitelistedAntiraid(cfg, userId) {
	if (!cfg) return false;
	if (cfg.whitelisted.includes(userId)) return true;
	return false;
}

function getRaidModule(cfg, type) {
	if (!cfg || !cfg.modules) return null;
	return cfg.modules.find((m) => m.type === type) || null;
}

// ---- Automod ----

async function getAutomodConfig(prisma, guildId) {
	return prisma.automodConfig.findUnique({
		where: { guildId },
		include: { filters: true, regexes: true, exemptions: true },
	});
}

async function ensureAutomodConfig(prisma, guildId) {
	return prisma.automodConfig.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
		include: { filters: true, regexes: true, exemptions: true },
	});
}

function isAutomodExempt(cfg, userId, channelId, roleId) {
	if (!cfg || !cfg.exemptions) return false;
	return cfg.exemptions.some((e) => {
		if (e.userId && e.userId === userId) return true;
		if (e.channelId && e.channelId === channelId) return true;
		if (e.roleId && roleId && e.roleId === roleId) return true;
		return false;
	});
}

function getFilter(cfg, type) {
	if (!cfg || !cfg.filters) return null;
	return cfg.filters.find((f) => f.type === type) || null;
}

function isFilterEnabled(cfg, type) {
	const f = getFilter(cfg, type);
	return f && f.enabled;
}

async function applyAutomodPunishment(client, guild, member, cfg, filterType) {
	const filter = getFilter(cfg, filterType);
	const action = (filter && filter.punishment) || cfg.punishment;
	const duration = (filter && filter.punishmentDuration) || cfg.punishmentDuration;
	const reason = "Automod: " + filterType;

	try {
		if (action === "delete") return "delete";
		if (action === "warn") {
			// warn via moderation case
			const moderation = require("./moderation");
			await moderation.createCase({
				prisma: client.db.prisma,
				guildId: guild.id,
				moderatorId: client.user.id,
				targetId: member.id,
				type: "warn",
				reason: reason,
			});
			return "warn";
		}
		if (action === "timeout" && duration) {
			await member.timeout(duration * 1000, reason);
			return "timeout";
		}
		if (action === "kick") {
			await member.kick(reason);
			return "kick";
		}
		if (action === "ban") {
			await member.ban({ reason, deleteMessageSeconds: 60 * 60 * 24 * 7 });
			return "ban";
		}
	} catch (err) {
		log.warn("Automod punish failed: " + err.message);
	}
	return null;
}

module.exports = {
	getAntinukeConfig, ensureAntinukeConfig, isWhitelistedAntinuke, getModule, isModuleEnabled, punishAntinuke,
	getAntiraidConfig, ensureAntiraidConfig, isWhitelistedAntiraid, getRaidModule,
	getAutomodConfig, ensureAutomodConfig, isAutomodExempt, getFilter, isFilterEnabled, applyAutomodPunishment,
};