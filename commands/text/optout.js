const { PermissionsBitField } = require("discord.js");
const db = require("../../db");

module.exports = {
	name: "optout",
	description: "Opt out of vote thank-you DMs",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],

	async execute(message, args) {
		const sub = args[0]?.toLowerCase();

		if (sub === "dms") {
			const existing = await db.prisma.userVoteStats.findUnique({
				where: { userId: message.author.id },
			});

			const currentlyOptedOut = existing?.voteDmOptOut ?? false;

			await db.prisma.userVoteStats.upsert({
				where: { userId: message.author.id },
				update: { voteDmOptOut: !currentlyOptedOut },
				create: {
					userId: message.author.id,
					voteDmOptOut: true,
				},
			});

			if (currentlyOptedOut) {
				return message.reply("✅ You'll now receive vote thank-you DMs again.");
			} else {
				return message.reply("✅ You've opted out of vote thank-you DMs. Run `c.optout dms` again to re-enable them.");
			}
		}

		return message.reply("Available options:\n`c.optout dms` — toggle vote thank-you DMs");
	},
};
