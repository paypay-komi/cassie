const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {
	name: "role",
	parent: "disable",
	description:
		"Deny a role from using a command. Usage: `c.manage disable role @role <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage disable role @role <command>`",
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
