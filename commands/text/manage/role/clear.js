const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "clear",
	parent: "role",
	description:
		"Remove a role's command access override. Usage: `c.manage role @role clear <command>`",

	async execute(message, args) {
		const roleId = this.parentRef?._targetRole;
		if (!roleId || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage role @role clear <command>`",
			);
		}

		const role = message.guild.roles.cache.get(roleId);

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.commandAccess.removeRoleAccess(
			message.guildId,
			roleId,
			commandId,
		);

		return message.reply(
			`✅ Cleared override for **${role.name}** on \`${input}\`.`,
		);
	},
};
