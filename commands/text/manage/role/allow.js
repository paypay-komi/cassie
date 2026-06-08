const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "allow",
	parent: "role",
	description:
		"Allow a role to use a command. Usage: `c.manage role @role allow <command>`",

	async execute(message, args) {
		const roleId = this.parentRef?._targetRole;
		if (!roleId || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage role @role allow <command>`",
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

		await message.client.db.commandAccess.setRoleAccess(
			message.guildId,
			roleId,
			commandId,
			true,
		);

		return message.reply(
			`✅ **${role.name}** is now allowed to use \`${input}\`.`,
		);
	},
};
