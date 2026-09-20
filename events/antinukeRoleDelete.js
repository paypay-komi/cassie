const { getLogger } = require("../lib/logger");
const automation = require("../lib/automation");

const log = getLogger("AntiNuke");
const actionTracker = new Map();

function trackAction(guildId, userId, type, window) {
	const key = guildId + ":" + userId + ":" + type;
	const now = Date.now();
	const entry = actionTracker.get(key);
	if (!entry || now - entry.firstAt > (window || 60) * 1000) {
		actionTracker.set(key, { count: 1, firstAt: now });
		return 1;
	}
	entry.count++;
	return entry.count;
}

module.exports = {
	name: "roleDelete",
	description: "Detects mass role deletions (antinuke)",

	async execute(client, role) {
		if (!role.guild) return;
		const guild = role.guild;
		const prisma = client.db.prisma;
		const cfg = await automation.getAntinukeConfig(prisma, guild.id);
		if (!cfg || !cfg.enabled) return;

		const audit = await guild.fetchAuditLogs({ type: 5, limit: 1 }).catch(() => null);
		const entry = audit && audit.entries.first();
		const executor = entry && entry.executor;
		if (!executor || executor.id === client.user.id) return;
		if (automation.isWhitelistedAntinuke(cfg, executor.id)) return;

		const mod = automation.getModule(cfg, "role");
		if (!mod || !mod.enabled) return;

		const count = trackAction(guild.id, executor.id, "role", mod.window);
		if (mod.threshold && count < mod.threshold) return;

		await automation.punishAntinuke(client, guild, executor.id, mod);
		log.warn("AntiNuke: punished " + executor.tag + " in " + guild.name + " for role destruction");
	},
};