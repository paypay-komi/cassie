const { PermissionsBitField } = require("discord.js");
const { parseSchema } = require("../../../lib/userDataMapper");

function formatBytes(bytes) {
	if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + " MB";
	if (bytes >= 1_000) return (bytes / 1_000).toFixed(1) + " kB";
	return bytes + " B";
}

module.exports = {

commandId: "a3f8c1b7-4d62-4e9a-9c3d-5f2e8a1b7c0d",
	name: "dbstatus",
	aliases: ["dbsize", "databasesize"],
	description: "Show database size breakdown by table and user.",
	permissions: ["botOwner"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
	],

	async execute(message, args) {
		const prisma = require("../../../db").prisma;

		// 1. Total DB size
		const [totalResult] = await prisma.$queryRawUnsafe(
			"SELECT pg_database_size(current_database()) AS bytes",
		);
		const totalBytes = Number(totalResult.bytes);

		// 2. Per-table sizes
		const tableSizes = await prisma.$queryRawUnsafe(`
			SELECT relname AS table_name, pg_total_relation_size(relid) AS bytes
			FROM pg_stat_user_tables
			ORDER BY bytes DESC
		`);

		// 3. Per-user size estimates across @userid-annotated tables
		const userFields = parseSchema();
		const userEstimates = {}; // { userId: { bytes, details: { table: rows } } }

		for (const [modelName, fields] of Object.entries(userFields)) {
			const tableInfo = tableSizes.find((t) => t.table_name === modelName);
			if (!tableInfo) continue;

			const tableBytes = Number(tableInfo.bytes);
			if (tableBytes === 0) continue;

			const [rowCountResult] = await prisma.$queryRawUnsafe(
				`SELECT COUNT(*)::int AS cnt FROM "${modelName}"`,
			);
			const totalRows = Number(rowCountResult.cnt);
			if (totalRows === 0) continue;

			for (const { field } of fields) {
				const perUser = await prisma.$queryRawUnsafe(
					`SELECT "${field}" AS user_id, COUNT(*)::int AS cnt FROM "${modelName}" GROUP BY "${field}"`,
				);

				for (const row of perUser) {
					const uid = row.user_id || "(null)";
					if (!userEstimates[uid]) userEstimates[uid] = { bytes: 0, details: {} };
					userEstimates[uid].bytes += Math.round(
						(Number(row.cnt) / totalRows) * tableBytes,
					);
					userEstimates[uid].details[modelName] =
						(userEstimates[uid].details[modelName] || 0) + Number(row.cnt);
				}
			}
		}

		// Sort users by estimated bytes descending
		const sortedUsers = Object.entries(userEstimates).sort(
			(a, b) => b[1].bytes - a[1].bytes,
		);

		// ---- Build message ----
		const totalFmt = formatBytes(totalBytes);

		// Line builder — returns each section as an array of strings
		const header = `📊 **Database Status** — Total: **${totalFmt}**\n`;

		const tableLines = ["**By Table:**"];
		for (const t of tableSizes) {
			const bytes = Number(t.bytes);
			const pct = totalBytes > 0 ? ((bytes / totalBytes) * 100).toFixed(1) : "0.0";
			tableLines.push(`\`${t.table_name}\` — ${formatBytes(bytes)} (${pct}%)`);
		}

		const userLines = ["\n**By User:**"];
		if (sortedUsers.length === 0) {
			userLines.push("*(no per-user data)*");
		} else {
			for (const [uid, data] of sortedUsers) {
				const pct = totalBytes > 0
					? ((data.bytes / totalBytes) * 100).toFixed(1)
					: "0.0";
				const detailStr = Object.entries(data.details)
					.sort((a, b) => b[1] - a[1])
					.map(([tbl, cnt]) => `${tbl}: ${cnt}`)
					.join(", ");
				userLines.push(`<@${uid}> — ${formatBytes(data.bytes)} (${pct}%) — ${detailStr}`);
			}
		}

		const allLines = [header, ...tableLines, ...userLines];

		// Split into 2000-char chunks
		const chunks = [];
		let current = "";
		for (const line of allLines) {
			const next = current + line + "\n";
			if (next.length > 1900) {
				chunks.push(current);
				current = line + "\n";
			} else {
				current = next;
			}
		}
		chunks.push(current);

		for (const chunk of chunks) {
			await message.channel.send(chunk);
		}
	},
};
