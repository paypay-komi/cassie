const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	MessageFlags,
} = require("discord.js");
const db = require("../../../db");

module.exports = {
	commandId: "b22b8b49-3d19-416e-a504-054e5fd820ab",
	name: "all",
	description: "Shows all vote leaderboards at once",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	aliases: ["leaderboard", "lb"],
	parent: "vote",

	async execute(message, args) {
		const [topVotes, topStreak, topActive] = await Promise.all([
			db.prisma.dblVote.findMany({
				orderBy: { totalVotes: "desc" },
				take: 10,
			}),
			db.prisma.dblVote.findMany({
				orderBy: { bestStreak: "desc" },
				take: 10,
			}),
			db.prisma.dblVote.findMany({
				orderBy: { voteStreak: "desc" },
				take: 10,
			}),
		]);

		const userIds = new Set([
			...topVotes.map((v) => v.userId),
			...topStreak.map((v) => v.userId),
			...topActive.map((v) => v.userId),
			message.author.id,
		]);

		const users = {};
		await Promise.all(
			[...userIds].map(async (id) => {
				users[id] = await message.client.users
					.fetch(id)
					.catch(() => null);
			}),
		);

		function formatTop(arr, key, unit) {
			if (arr.length === 0) return "No votes yet";
			return arr
				.map((v, i) => {
					const name =
						users[v.userId]?.displayName ?? `\`${v.userId}\``;
					return `${i + 1}. **${name}** — ${v[key]} ${unit}`;
				})
				.join("\n");
		}

		let footer = "";
		const me = await db.prisma.dblVote.findUnique({
			where: { userId: message.author.id },
		});

		if (me) {
			const [rVotes, rStreak, rActive] = await Promise.all([
				db.prisma.dblVote.count({
					where: { totalVotes: { gt: me.totalVotes } },
				}),
				db.prisma.dblVote.count({
					where: { bestStreak: { gt: me.bestStreak } },
				}),
				db.prisma.dblVote.count({
					where: { voteStreak: { gt: me.voteStreak } },
				}),
			]);
			footer = `-# Your rank: #${rVotes + 1} votes · #${rStreak + 1} best streak · #${rActive + 1} active streak`;
		} else {
			footer = "-# You haven't voted yet!";
		}

		const spacer = new SeparatorBuilder().setSpacing(
			SeparatorSpacingSize.Small,
		);

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`# 🏆 Vote Leaderboard\n${formatTop(topVotes, "totalVotes", "votes")}`,
				),
			)
			.addSeparatorComponents(spacer)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`## 🔥 Best Streak\n${formatTop(topStreak, "bestStreak", "best")}`,
				),
			)
			.addSeparatorComponents(spacer)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`## ⚡ Active Streak\n${formatTop(topActive, "voteStreak", "current")}`,
				),
			)
			.addSeparatorComponents(spacer)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(footer),
			);

		await message.reply({
			components: [container],
			flags: MessageFlags.IsComponentsV2,
		});
	},
};
