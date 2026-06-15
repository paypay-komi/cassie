/**
 * Smart channel detection for announcement delivery.
 * Priority: system channel → announcement channels → well-known names → most popular → first available.
 *
 * @param {import('discord.js').Guild} guild
 * @returns {import('discord.js').TextChannel|null}
 */
function findAnnouncementChannel(guild) {
	const PRIORITY_NAMES = [
		"general",
		"bots",
		"commands",
		"bot-commands",
		"lounge",
		"chat",
		"discussions",
	];

	// 1. System channel
	if (
		guild.systemChannel?.permissionsFor(guild.members.me)?.has("SendMessages")
	) {
		return guild.systemChannel;
	}

	// 2. Announcement/news channels (type 5) — best fit for bot announcements
	const announcementChannels = guild.channels.cache.filter(
		(c) =>
			c.type === 5 &&
			c.permissionsFor(guild.members.me).has("SendMessages") &&
			c.permissionsFor(guild.members.me).has("ManageWebhooks"),
	);
	if (announcementChannels.size > 0) {
		return announcementChannels.first();
	}

	const textChannels = guild.channels.cache.filter(
		(c) =>
			c.type === 0 &&
			c.permissionsFor(guild.members.me).has("SendMessages"),
	);

	// 3. Priority names
	for (const name of PRIORITY_NAMES) {
		const found = textChannels.find(
			(c) =>
				c.name.toLowerCase() === name ||
				c.name.toLowerCase().startsWith(name + "-"),
		);
		if (found) return found;
	}

	// 4. Most popular (most members can see)
	const sorted = [...textChannels.values()].sort(
		(a, b) => b.members.size - a.members.size,
	);

	// 5. Fallback
	return sorted[0] || null;
}

module.exports = { findAnnouncementChannel };
