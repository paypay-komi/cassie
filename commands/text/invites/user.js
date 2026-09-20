const { buildMessage } = require("../../../lib/v2Reply");
const tracker = require("../../../lib/inviteTracker");

module.exports = {

commandId: "0d8d1291-97a3-4dcd-bce0-67909ea4b197",
	name: "user",
	parent: "invites",
	description: "Show invite stats for a user",
	dmUse: false,

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const target = message.mentions.users.first() || message.author;

		const member = await message.guild.members
			.fetch(target.id)
			.catch(() => null);
		const s = await tracker.getStats(
			prisma,
			message.guild.id,
			target.id,
			member,
		);

		const lines = [
			`## 📨 Invites — ${target.username}`,
			`**Real:** ${s.regular}`,
			`**Bonus (roles):** ${s.bonus}`,
			`**Adjustment:** ${s.adjust}`,
			`**Total:** ${s.total}`,
			`**Left:** ${s.leaves}`,
			`**Fake:** ${s.fake}`,
		];

		return message.reply(buildMessage(lines.join("\n"), 0x5865f2));
	},
};
