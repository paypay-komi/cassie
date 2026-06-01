const { PermissionsBitField } = require("discord.js");
const db = require("../../db");

module.exports = {
	name: "mydata",
	description: "View all data the bot stores about you as a JSON dump.",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],

	async execute(message) {
		const uid = message.author.id;

		// Get all user-defined tables (skip sqlite_ internal + prisma migrations)
		const tables = await db.prisma.$queryRawUnsafe(
			`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'`,
		);

		const result = {};

		for (const { name: table } of tables) {
			// Get column info for this table
			const cols = await db.prisma.$queryRawUnsafe(
				`SELECT name, type FROM pragma_table_info(?)`,
				table,
			);

			// Only search TEXT-like columns for the user ID
			const textCols = cols
				.filter(
					(c) =>
						c.type &&
						(c.type.toUpperCase().includes("TEXT") ||
							c.type.toUpperCase().includes("CHAR") ||
							c.type.toUpperCase().includes("JSON") ||
							c.type.toUpperCase() === ""),
				)
				.map((c) => c.name);

			// Always search all columns too — IDs might be stored as numeric strings
			const allCols = cols.map((c) => c.name);

			if (textCols.length === 0) continue;

			// Build WHERE clause: search each text column for this user ID
			const conditions = textCols
				.map((col) => `"${col}" LIKE ?`)
				.join(" OR ");

			const params = textCols.map(() => `%${uid}%`);

			const rows = await db.prisma.$queryRawUnsafe(
				`SELECT * FROM "${table}" WHERE ${conditions}`,
				...params,
			);

			if (rows.length > 0) {
				result[table] = rows;
			}
		}

		const json = JSON.stringify(
			{ userId: uid, tables: result },
			null,
			2,
		);

		if (json.length > 1900) {
			await message.reply(
				`Your data is too large for one message. Sending as a file...`,
			);
			return message.channel.send({
				files: [
					{
						attachment: Buffer.from(json, "utf-8"),
						name: `mydata-${uid}.json`,
					},
				],
			});
		}

		await message.reply(`\`\`\`json\n${json}\n\`\`\``);
	},
};
