const { resolveRequired } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "4a347d05-f85e-4d57-b954-eaed7c008f30",
	name: "role",
	parent: "enable",
	description:
		"Allow a role to use a command. Usage: `c.manage enable role @role <command>`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage enable role @role <command>`",
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
			true,
		);

		return message.reply(
			`✅ **${role.name}** is now allowed to use \`${input}\`.`,
		);
	},
};
