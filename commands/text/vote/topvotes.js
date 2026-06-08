const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MessageFlags,
} = require("discord.js");
const db = require("../../../db");

module.exports = {
	commandId: "4d92c12c-fb1f-46b8-8d1f-530e17191429",
	name: "topvotes",
	aliases: ["votes", "mostvotes", "total"],
	description: "Shows the users with the most total votes",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "vote",

	async execute(message, args) {
		const top = await db.prisma.dblVote.findMany({
			orderBy: { totalVotes: "desc" },
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
				where: { totalVotes: { gt: me.totalVotes } },
			});
			footer = `-# Your rank: #${rank + 1} with ${me.totalVotes} votes`;
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
							return `${i + 1}. **${name}** — ${v.totalVotes} votes`;
						})
						.join("\n");

		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`# 🏆 Top Voters\n${lines}`,
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
