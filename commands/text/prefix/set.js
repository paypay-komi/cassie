module.exports = {
	name: "set",
	parent: "prefix",
	description: "Set your own custom command prefix.",

	async execute(message, args) {
		if (!args.length) {
			return message.reply(
				"Usage: `c.prefix set <prefix>` — e.g. `c.prefix set !`",
			);
		}

		const newPrefix = args.join(" ").trim();

		if (newPrefix.length > 10) {
			return message.reply("Prefix must be 10 characters or less.");
		}

		if (newPrefix === "c.") {
			return message.reply("`c.` is already the universal prefix.");
		}

		await message.client.db.userPrefix.set(message.author.id, newPrefix);

		message.reply(
			`Your prefix has been set to \`${newPrefix}\`. Remember \`c.\` also works!`,
		);
	},
};
