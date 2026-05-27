const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const db = require("../../../db/boobs.js");

module.exports = {
	name: "topstreak",
	aliases: ["streak", "beststreak"],
	description: "Shows the users with the highest best streak",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "vote",

	async execute(message, args) {
		const top = await db.prisma.dblVote.findMany({
			orderBy: { bestStreak: "desc" },
			take: 10,
		});

		const users = {};
		await Promise.all(
			top.map(async (v) => {
				users[v.userId] = await message.client.users
					.fetch(v.userId)
					.catch(() => null);
			}),
		);

		const me = await db.prisma.dblVote.findUnique({
			where: { userId: message.author.id },
		});

		let footer = "";
		if (me) {
			const rank = await db.prisma.dblVote.count({
				where: { bestStreak: { gt: me.bestStreak } },
			});
			footer = `-# Your rank: #${rank + 1} with best streak of ${me.bestStreak}`;
		} else {
			footer = "-# You haven't voted yet!";
		}

		const lines =
			top.length === 0
				? "No votes yet"
				: top
						.map((v, i) => {
							const name =
								users[v.userId]?.displayName ??
								`\`${v.userId}\``;
							return `${i + 1}. **${name}** — best ${v.bestStreak}`;
						})
						.join("\n");

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`# 🔥 Best Streak\n${lines}`,
				),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(footer),
			);

		await message.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	},
};
