const { PermissionsBitField } = require("discord.js");
const db = require("../../db");
const { parseSchema } = require("../../lib/userDataMapper");

module.exports = {

commandId: "44cb174d-20ee-48e4-90d8-3adad8a91a9a",
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

		// AUTO-DISCOVERED from // @userid annotations in schema.prisma
		const schemaMap = parseSchema();

		const result = {};

		for (const [model, fields] of Object.entries(schemaMap)) {
			try {
				let rows;
				if (fields.length === 1) {
					rows = await prisma[model].findMany({
						where: { [fields[0].field]: uid },
					});
				} else {
					// Model has multiple @userid fields — OR them together
					rows = await prisma[model].findMany({
						where: {
							OR: fields.map((f) => ({ [f.field]: uid })),
						},
					});
				}

				if (rows?.length) {
					result[model] = rows;
				}
			} catch (err) {
				console.log(`Skipping ${model}:`, err.message);
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
