const { idToName } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "4e5bf898-519a-466c-b1cf-b4bb9e5cce1d",
	name: "role",
	parent: "list",
	description: "List all role-based command access overrides. Optionally filter by role: `c.manage list role @role`",

	async execute(message, args) {
		const { db, guild } = message.client;

		const where = { guildId: message.guildId };

		// Optional role filter
		let targetRole = null;
		if (args.length) {
			const roleId = args[0].replace(/[<@&>]/g, "");
			targetRole = message.guild.roles.cache.get(roleId);
			if (!targetRole) return message.reply("❌ Role not found.");
			where.roleId = roleId;
		}

		const rows = await db.prisma.guildRoleCommandAccess.findMany({ where });

		if (!rows.length) {
			return message.reply(
				targetRole
					? `No command overrides for ${targetRole}.`
					: "No role-based command overrides configured.",
			);
		}

		const lines = [];
		for (const r of rows) {
			const name = idToName(message.client, r.commandId) ?? `${r.commandId} *(unknown)*`;
			const role = message.guild.roles.cache.get(r.roleId);
			const roleName = role ? role.name : r.roleId;
			const tag = r.allowed ? "✅ allow" : "🚫 deny";
			lines.push(`• ${tag} **${roleName}** → \`${name}\``);
		}

		lines.sort();
		let current = "👥 **Role Command Overrides**\n\n";
		for (const line of lines) {
			const next = current + line + "\n";
			if (next.length > 1900) {
				await message.channel.send(current);
				current = line + "\n";
			} else {
				current = next;
			}
		}
		await message.channel.send(current);
	},
};
