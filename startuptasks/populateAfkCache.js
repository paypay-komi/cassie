module.exports = {
	name: "loadAfkCache",
	description: "polulates the afk cache",
	reloadAble: true,
	async execute(client) {
		const rows = await client.db.prisma.GlobalAfkUser.findMany();
		for (const row of rows) {
			client.afk.set(row.userId, row);
		}
	},
};
