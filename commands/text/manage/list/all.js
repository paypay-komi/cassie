const { idToName } = require("../../../../lib/commandResolver");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "4cdde65a-2ac5-4fd6-933c-b79b91e14749",
	name: "all",
	parent: "list",
	description: "List all command overrides in one view.",

	async execute(message, args) {
		const { db, guild } = message.client;
		const guildId = message.guildId;

		const [guildRows, channelRows, roleRows, userRows] = await Promise.all([
			db.prisma.guildDisabledCommand.findMany({
				where: { guildId },
				orderBy: { commandId: "asc" },
			}),
			db.prisma.guildChannelCommandAccess.findMany({
				where: { guildId },
				orderBy: [{ channelId: "asc" }, { commandId: "asc" }],
			}),
			db.prisma.guildRoleCommandAccess.findMany({
				where: { guildId },
				orderBy: [{ roleId: "asc" }, { commandId: "asc" }],
			}),
			db.prisma.guildUserCommandAccess.findMany({
				where: { guildId },
				orderBy: [{ userId: "asc" }, { commandId: "asc" }],
			}),
		]);

		const parts = [];

		// Guild disables
		if (guildRows.length) {
			const lines = guildRows.map((r) => {
				const name = idToName(message.client, r.commandId);
				return `• \`${name || r.commandId}\``;
			});
			parts.push(`🚫 **Guild-Disabled** (${guildRows.length}):\n${lines.join("\n")}`);
		}

		// Channel overrides
		if (channelRows.length) {
			const lines = channelRows.map((r) => {
				const name = idToName(message.client, r.commandId);
				const ch = message.guild.channels.cache.get(r.channelId);
				const chName = ch ? ch.toString() : `\`${r.channelId}\``;
				const icon = r.allowed ? "✅" : "🚫";
				return `• ${chName} ${icon} \`${name || r.commandId}\``;
			});
			parts.push(`📺 **Channel Overrides** (${channelRows.length}):\n${lines.join("\n")}`);
		}

		// Role overrides
		if (roleRows.length) {
			const lines = roleRows.map((r) => {
				const name = idToName(message.client, r.commandId);
				const role = message.guild.roles.cache.get(r.roleId);
				const roleName = role ? role.name : `\`${r.roleId}\``;
				const icon = r.allowed ? "✅" : "🚫";
				return `• **${roleName}** ${icon} \`${name || r.commandId}\``;
			});
			parts.push(`👤 **Role Overrides** (${roleRows.length}):\n${lines.join("\n")}`);
		}

		// User overrides
		if (userRows.length) {
			const lines = userRows.map((r) => {
				const name = idToName(message.client, r.commandId);
				const icon = r.allowed ? "✅" : "🚫";
				return `• \`${r.userId}\` ${icon} \`${name || r.commandId}\``;
			});
			parts.push(`👤 **User Overrides** (${userRows.length}):\n${lines.join("\n")}`);
		}

		if (!parts.length) {
			return message.reply(pingSafeMesage("✅ No overrides set for this server.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
		}

		const full = parts.join("\n\n");

		// Try replying with the full content first
		if (full.length <= 2000) {
			return message.reply(pingSafeMesage(full));
		}

		// ── Split across multiple followUp messages ──
		// Flatten into individual lines (each line is a bullet point or section header)
		const allLines = [];
		for (const part of parts) {
			const lines = part.split("\n");
			allLines.push(...lines);
		}

		let current = "";
		for (const line of allLines) {
			const next = current ? `${current}\n${line}` : line;
			if (next.length > 1900) {
				await message.channel.send(pingSafeMesage(current));
				current = line;
			} else {
				current = next;
			}
		}
		if (current) await message.channel.send(pingSafeMesage(current + "\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
	},
};
