const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "deny",
	parent: "role",
	description:
		"Deny a role from using a command. Usage: `c.manage role @role deny <command>`",

	async execute(message, args) {
		const target = this._middleArgs?.[0];
		if (!target || !args.length) {
			return message.reply(
				"❌ Usage: `c.manage role @role deny <command>`",
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
			false,
		);

		return message.reply(
			`🚫 **${role.name}** is now denied from using \`${input}\`.`,
		);
	},
};
