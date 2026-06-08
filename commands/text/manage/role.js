module.exports = {
	name: "role",
	parent: "manage",
	description:
		"Manage role-based command access. Provide the role, then: allow, deny, or clear.",

	async execute(message, args, next) {
		if (!args.length) {
			return message.reply(
				"❌ Usage: `c.manage role @role <allow|deny|clear> <command>`",
			);
		}

		// Consume the target role
		const raw = args.shift();
		const roleId = raw.replace(/[<@&>]/g, "");
		const role = message.guild.roles.cache.get(roleId);
		if (!role) return message.reply("❌ Role not found.");

		// Store for subcommands to access
		this._targetRole = roleId;

		// Continue resolving subcommands with remaining args
		return next(args);
	},
};
