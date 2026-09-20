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
	name: "guildBanAdd",
	description: "Detects mass bans (antinuke)",

	async execute(client, guildBan) {
		const { guild, executor } = guildBan;
		if (!executor || executor.id === client.user.id) return;

		const prisma = client.db.prisma;
		const cfg = await automation.getAntinukeConfig(prisma, guild.id);
		if (!cfg || !cfg.enabled) return;
		if (automation.isWhitelistedAntinuke(cfg, executor.id)) return;

		const mod = automation.getModule(cfg, "ban");
		if (!mod || !mod.enabled) return;

		const count = trackAction(guild.id, executor.id, "ban", mod.window);
		if (mod.threshold && count < mod.threshold) return;

		await automation.punishAntinuke(client, guild, executor.id, mod);
		log.warn("AntiNuke: punished " + executor.tag + " in " + guild.name + " for mass bans");
	},
};