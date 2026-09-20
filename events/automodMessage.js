const { getLogger } = require("../lib/logger");
const automation = require("../lib/automation");

const log = getLogger("Automod");
const spamTracker = new Map();

module.exports = {
	name: "automodMessage",
	description: "Runs automod filters on incoming messages",

	async execute(client, message) {
		if (!message.guild || message.author.bot) return;
		const prisma = client.db.prisma;
		const guild = message.guild;
		const cfg = await automation.getAutomodConfig(prisma, guild.id);
		if (!cfg || !cfg.enabled) return;
		if (automation.isAutomodExempt(cfg, message.author.id, message.channel.id)) return;

	const content = message.content || "";
	let triggered = false;
	let triggerType = null;

	// Caps filter
	const capsFilter = automation.getFilter(cfg, "caps");
	if (capsFilter && capsFilter.enabled) {
		const letters = content.replace(/[^a-zA-Z]/g, "");
		if (letters.length >= (capsFilter.threshold || 10)) {
			const upper = letters.replace(/[^A-Z]/g, "").length;
			if (upper / letters.length > 0.7) {
				triggered = true;
				triggerType = "caps";
			}
		}
	}

	// Links filter
	const linksFilter = automation.getFilter(cfg, "links");
	if (linksFilter && linksFilter.enabled && !triggered) {
		const urlRegex = /https?:\/\/[^\s]+/gi;
		const urls = content.match(urlRegex) || [];
		const allowed = linksFilter.whitelisted || [];
		const blocked = urls.filter((u) => !allowed.some((a) => u.toLowerCase().includes(a.toLowerCase())));
		if (blocked.length > 0) {
			triggered = true;
			triggerType = "links";
		}
	}

	// Invites filter
	const invitesFilter = automation.getFilter(cfg, "invites");
	if (invitesFilter && invitesFilter.enabled && !triggered) {
		const inviteRegex = /(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
		if (inviteRegex.test(content)) {
			triggered = true;
			triggerType = "invites";
		}
	}

	// Mass mention filter
	const mentionFilter = automation.getFilter(cfg, "massmention");
	if (mentionFilter && mentionFilter.enabled && !triggered) {
		const mentionCount = (content.match(/<@[!&]?\d+>/g) || []).length;
		if (mentionCount >= (mentionFilter.threshold || 5)) {
			triggered = true;
			triggerType = "massmention";
		}
	}

	// Spam filter (same user, same channel, rapid messages)
	const spamFilter = automation.getFilter(cfg, "spam");
	if (spamFilter && spamFilter.enabled && !triggered) {
		const key = guild.id + ":" + message.channel.id + ":" + message.author.id;
		const now = Date.now();
		const windowSec = spamFilter.window || 5;
		const maxCount = spamFilter.threshold || 5;
		const entry = spamTracker.get(key);
		if (!entry || now - entry.firstAt > windowSec * 1000) {
			spamTracker.set(key, { count: 1, firstAt: now });
		} else {
			entry.count++;
			if (entry.count >= maxCount) {
				triggered = true;
				triggerType = "spam";
			}
		}
	}

	// Keyword filter
	const kwFilter = automation.getFilter(cfg, "keyword");
	if (kwFilter && kwFilter.enabled && !triggered) {
		const blacklisted = kwFilter.blacklisted || [];
		const lower = content.toLowerCase();
		if (blacklisted.some((w) => lower.includes(w.toLowerCase()))) {
			triggered = true;
			triggerType = "keyword";
		}
	}

	// Custom regex filters
	if (!triggered && cfg.regexes) {
		for (const regex of cfg.regexes) {
			if (!regex.enabled) continue;
			try {
				if (new RegExp(regex.pattern, "i").test(content)) {
					triggered = true;
					triggerType = "regex:" + regex.name;
					break;
				}
			} catch (e) { /* invalid regex */ }
		}
	}

	if (triggered) {
		const action = await automation.applyAutomodPunishment(client, guild, message.member, cfg, triggerType);
		if (action === "delete") {
			await message.delete().catch(() => {});
		}
		log.info("Automod triggered (" + triggerType + ") in " + guild.name + " by " + message.author.tag);
	}
	},
};