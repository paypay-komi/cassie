// Handles reaction role REMOVE — removes role when user unreacts
const { Events } = require("discord.js");
const { getLogger } = require("../lib/logger");
const log = getLogger("reactionRoleRemove");
const db = require("../db");
const trackedMessages = require("../lib/reactionRoleCache");

function getEmojiKey(reaction) {
	if (reaction.emoji.id) return `custom:${reaction.emoji.id}`;
	return reaction.emoji.name;
}

module.exports = {
	name: Events.MessageReactionRemove,
	description: "Handles reaction role remove",
	async execute(client, reaction, user) {
		if (user.bot) return;
		if (reaction.message.partial) { try { await reaction.message.fetch(); } catch { return; } }

		const msgId = reaction.message.id;
		let tracked = trackedMessages.get(msgId);

		if (!tracked) {
			const rr = await db.prisma.reactionRole.findUnique({
				where: { messageId: msgId },
				include: { entries: true },
			}).catch(() => null);
			if (!rr) return;
			tracked = { guildId: rr.guildId, channelId: rr.channelId, entries: rr.entries.map((e) => ({ emoji: e.emoji, roleId: e.roleId })) };
			trackedMessages.set(msgId, tracked);
		}

		const emojiKey = getEmojiKey(reaction);
		const entry = tracked.entries.find((e) => e.emoji === emojiKey);
		if (!entry) return;

		const guild = client.guilds.cache.get(tracked.guildId);
		if (!guild) return;
		const member = await guild.members.fetch(user.id).catch(() => null);
		if (!member) return;

		try {
			await member.roles.remove(entry.roleId);
			log.debug(`Removed role ${entry.roleId} from ${user.tag}`);
		} catch (err) {
			log.error(`Failed to remove role ${entry.roleId} from ${user.tag}:`, err);
		}
	},
};
