module.exports = {
	name: "prefix",
	description: "View or change your custom command prefix. `c.` always works.",

	async execute(message, args) {
		if (args.length) {
			return message.reply(
				`Unknown subcommand \`${args[0]}\`. Available: \`set\`, \`reset\``,
			);
		}

		// No args → show current prefix
		const data = await message.client.db.userPrefix.get(
			message.author.id,
		);

		if (data?.prefix) {
			message.reply(
				`Your custom prefix is \`${data.prefix}\`. The universal prefix \`c.\` also works.\n` +
					`To change it: \`c.prefix set <prefix>\`\n` +
					`To remove it: \`c.prefix reset\``,
			);
		} else {
			message.reply(
				`You don't have a custom prefix set. The universal prefix is \`c.\`\n` +
					`To set one: \`c.prefix set <prefix>\``,
			);
		}
	},
};
