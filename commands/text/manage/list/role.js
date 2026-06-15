const { idToName } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "4e5bf898-519a-466c-b1cf-b4bb9e5cce1d",
	name: "role",
	parent: "list",
	description: "List all role-based command access overrides. Optionally filter by role: `c.manage list role @role`",
	args: ArgsBuilder.create()
		.role("role", { description: "Optional role to filter by" }),

	async execute(message, args) {
		const { db, guild } = message.client;

		const where = { guildId: message.guildId };

		// Optional role filter
		let targetRole = null;
		if (args.length) {
			const raw = args[0];
			let roleId;
			if (raw === "@everyone") {
				targetRole = message.guild.roles.everyone;
				roleId = message.guild.id;
			} else {
				roleId = raw.replace(/[<@&>]/g, "");
				targetRole = message.guild.roles.cache.get(roleId);
			}
			if (!targetRole) return message.reply(pingSafeMesage("❌ Role not found."));
			where.roleId = roleId;
		}

		const rows = await db.prisma.guildRoleCommandAccess.findMany({ where });

		if (!rows.length) {
			return message.reply(pingSafeMesage(
				targetRole
					? `No command overrides for ${targetRole}.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`
					: "No role-based command overrides configured.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.",
			));
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
				await message.channel.send(pingSafeMesage(current));
				current = line + "\n";
			} else {
				current = next;
			}
		}
		await message.channel.send(pingSafeMesage(current + "\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management."));
	},
};
