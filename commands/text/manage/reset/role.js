const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "84ed026c-f9b6-492b-9b65-3f9288d5a26d",
	name: "role",
	parent: "reset",
	description:
		"Remove role-level allow/deny for a command. Usage: `c.manage reset role @role <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage reset role @role <command>`",
			);
		}

		const raw = args.shift();
		const roleId = raw.replace(/[<@&>]/g, "");
		const role = message.guild.roles.cache.get(roleId);
		if (!role) return message.reply("❌ Role not found.");

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.prisma.guildRoleCommandAccess.deleteMany({
			where: { guildId: message.guildId, roleId, commandId },
		});

		return message.reply(
			`✅ Override removed for **${role.name}** on \`${input}\`. It now uses default permissions.`,
		);
	},
};
