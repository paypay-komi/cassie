const { PermissionsBitField } = require("discord.js");
const db = require("../../db");

module.exports = {
	name: "mydata",
	description: "Export all user data from Postgres as JSON.",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.AttachFiles,
	],
	guildUse: false,

	async execute(message) {
		const uid = message.author.id;

		await message.reply(
			"⚠️ Exporting all stored data about you...\n\nWorking...",
		);

		const prisma = db.prisma;

		// STATIC MAP (replaces table introspection)
		const tableMap = {
			userGlobalCommandStats: { field: "userId" },
			userCommandStats: { field: "userId" },
			todolist: { field: "userId" },
			reminder: { field: "userId" },
			globalAfkUser: { field: "userId" },
			globalAfkMention: { field: "userId" },
			userTimezone: { field: "userId" },
			guildUserSettings: { field: "userId" },
			userVoteStats: { field: "userId" },
			dblVote: { field: "userId" },
			idea: { field: "authorId" },
			ideaVote: { field: "userId" },
			courtCase: { field: "defendantId" },
			courtVote: { field: "voterId" },
		};

		const result = {};

		for (const [table, cfg] of Object.entries(tableMap)) {
			try {
				const rows = await prisma[table].findMany({
					where: {
						[cfg.field]: uid,
					},
				});

				if (rows?.length) {
					result[table] = rows;
				}
			} catch (err) {
				console.log(`Skipping ${table}:`, err.message);
				continue;
			}
		}

		const json = JSON.stringify({ userId: uid, tables: result }, null, 2);

		return message.channel.send({
			files: [
				{
					attachment: Buffer.from(json, "utf-8"),
					name: `mydata-${uid}.json`,
				},
			],
		});
	},
};
