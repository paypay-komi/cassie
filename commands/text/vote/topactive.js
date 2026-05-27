const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const db = require("../../db/boobs.js");

module.exports = {
	name: "topactive",
	aliases: ["active", "current", "activestreak"],
	description: "Shows the users with the longest active streak",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "vote",

	async execute(message, args) {
		const top = await db.prisma.dblVote.findMany({
			orderBy: { voteStreak: "desc" },
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
				where: { voteStreak: { gt: me.voteStreak } },
			});
			footer = `-# Your rank: #${rank + 1} with active streak of ${me.voteStreak}`;
		} else {
			footer = "-# You haven't voted yet!";
		}

		const lines =
			top.length === 0
				? "No active streaks"
				: top
						.map((v, i) => {
							const name =
								users[v.userId]?.displayName ??
								`\`${v.userId}\``;
							return `${i + 1}. **${name}** — current ${v.voteStreak}`;
						})
						.join("\n");

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`# ⚡ Active Streak\n${lines}`,
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
