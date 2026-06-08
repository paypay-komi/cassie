module.exports = {
	commandId: "b3975091-61d1-481a-bdcd-d83171fbf55d",
	name: "reset",
	parent: "prefix",
	description: "Remove your custom prefix and go back to just `c.`.",

	async execute(message) {
		await message.client.db.userPrefix.reset(message.author.id);
		message.reply(
			"Your custom prefix has been removed. Only `c.` will work now.",
		);
	},
};
