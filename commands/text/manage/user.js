module.exports = {
	name: "user",
	parent: "manage",
	description:
		"Manage user-based command access. Provide the user, then: allow, deny, or clear.",

	async execute(message, args, next) {
		if (!args.length) {
			return message.reply(
				"❌ Usage: `c.manage user @user <allow|deny|clear> <command>`",
			);
		}

		// Consume the target user
		const raw = args.shift();
		const userId = raw.replace(/[<@!>]/g, "");

		// Validate user exists
		try {
			await message.client.users.fetch(userId);
		} catch {
			return message.reply("❌ User not found.");
		}

		// Store for subcommands to access
		this._targetUser = userId;

		// Continue resolving subcommands with remaining args
		return next(args);
	},
};
