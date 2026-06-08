const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "allow",
	parent: "role",
	description:
		"Allow a role to use a command. Usage: `c.manage role @role allow <command>`",

	async execute(message, args) {
		const target = this._middleArgs?.[0];
		if (!target || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage role @role allow <command>`",
			);
		}

		const roleId = target.replace(/[<@&>]/g, "");
		const role = message.guild.roles.cache.get(roleId);
		if (!role) return message.reply("❌ Role not found.");

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
