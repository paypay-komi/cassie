const { PermissionsBitField } = require("discord.js");

module.exports = {

commandId: "f7b2c1a4-3d8e-4f0a-9b6c-7d5e1f2a3b4c",
	name: "invitestats",
	aliases: ["invitestat", "istats"],
	description: "Show invite link click counts grouped by referral source.",
	permissions: ["botOwner"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
	],

	async execute(message, args) {
		const db = require("../../../db");

		const [totalRows, matchedRows] = await Promise.all([
			db.prisma.inviteClick.groupBy({
				by: ["ref"],
				_count: { id: true },
				orderBy: { _count: { id: "desc" } },
			}),
			db.prisma.inviteClick.groupBy({
				by: ["ref"],
				where: { guildId: { not: null } },
				_count: { id: true },
			}),
		]);

		if (!totalRows.length) {
			return message.reply("No invite clicks recorded yet.");
		}

		const total = totalRows.reduce((s, r) => s + r._count.id, 0);
		const matchedTotal = matchedRows.reduce((s, r) => s + r._count.id, 0);
		const matchedMap = {};
		for (const r of matchedRows) matchedMap[r.ref] = r._count.id;

		let output = `📊 **Invite Stats** — ${total} total, ${matchedTotal} joined\n\n`;
		for (const r of totalRows) {
			const pct = ((r._count.id / total) * 100).toFixed(1);
			const joined = matchedMap[r.ref] || 0;
			output += `\`${r.ref.padEnd(20)}\` ${r._count.id.toString().padStart(4)} clicks (${pct}%) — ${joined} joined\n`;
		}

		await message.reply(output);
	},
};
