const { getLogger } = require("../../lib/logger");
const db = require("../../db");
const trackedMessages = require("../../lib/reactionRoleCache");

module.exports = {
	name: "initReactionRoles",
	description: "Preloads reaction role messages into memory cache on startup",
	needsReadyClient: true,
	async execute(client) {
		const log = getLogger("ReactionRoles");
		try {
			const rrs = await db.prisma.reactionRole.findMany({
				include: { entries: true },
			});
			for (const rr of rrs) {
				trackedMessages.set(rr.messageId, {
					guildId: rr.guildId,
					channelId: rr.channelId,
					entries: rr.entries.map((e) => ({ emoji: e.emoji, roleId: e.roleId })),
				});
			}
			log.info(`✅ Loaded ${rrs.length} reaction role messages (${trackedMessages.size} tracked)`);
		} catch (err) {
			log.error("Failed to load reaction roles:", err);
		}
	},
};
