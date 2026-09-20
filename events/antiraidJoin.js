const { getLogger } = require("../lib/logger");
const automation = require("../lib/automation");

const log = getLogger("AntiRaid");
const joinTracker = new Map();

module.exports = {
	name: "antiraidJoin",
	description: "Detects raids via account age, mass joins, and username patterns",

	async execute(client, member) {
		if (!member.guild) return;
		const guild = member.guild;
		const prisma = client.db.prisma;
		const cfg = await automation.getAntiraidConfig(prisma, guild.id);
		if (!cfg || !cfg.enabled) return;
		if (automation.isWhitelistedAntiraid(cfg, member.id)) return;

		// Account age check
		const ageMod = automation.getRaidModule(cfg, "age");
		if (ageMod && ageMod.enabled && ageMod.maxAgeDays) {
			const accountAge = Date.now() - member.user.createdAt.getTime();
			const maxMs = ageMod.maxAgeDays * 24 * 60 * 60 * 1000;
			if (accountAge < maxMs) {
				const action = ageMod.action || "kick";
				try {
					if (action === "ban") await member.ban({ reason: "AntiRaid: account too young" });
					else await member.kick("AntiRaid: account too young");
				} catch (err) { log.warn("Age punish failed: " + err.message); }
				return;
			}
		}

		// Username pattern check
		const userMod = automation.getRaidModule(cfg, "username");
		if (userMod && userMod.enabled && userMod.usernamePatterns && userMod.usernamePatterns.length) {
			const name = member.user.username.toLowerCase();
			for (const pat of userMod.usernamePatterns) {
				if (name.includes(pat.toLowerCase())) {
					const action = userMod.action || "kick";
					try {
						if (action === "ban") await member.ban({ reason: "AntiRaid: username match" });
						else await member.kick("AntiRaid: username match");
					} catch (err) { log.warn("Username punish failed: " + err.message); }
					return;
				}
			}
		}

		// Mass join detection
		const massMod = automation.getRaidModule(cfg, "massjoin");
		if (massMod && massMod.enabled && massMod.threshold) {
			const key = guild.id + ":massjoin";
			const now = Date.now();
			const entry = joinTracker.get(key);
			if (!entry || now - entry.firstAt > (massMod.window || 30) * 1000) {
				joinTracker.set(key, { count: 1, firstAt: now });
			} else {
				entry.count++;
				if (entry.count >= massMod.threshold) {
					// Lockdown
					await prisma.antiraidConfig.update({
						where: { guildId: guild.id },
						data: { lockdown: true },
					}).catch(() => {});

					// Lock @everyone
					await guild.roles.everyone.setPermissions(
						guild.roles.everyone.permissions.remove("SendMessages"),
						"AntiRaid: lockdown",
					).catch(() => {});

					log.warn("AntiRaid: lockdown triggered in " + guild.name + " (" + entry.count + " joins)");
				}
			}
		}
	},
};