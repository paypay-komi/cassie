module.exports = {
	name: "messageCreate",
	description: "meows when message contains a meow like word",

	execute(client, message) {
		// Ignore bots
		if (message.author.bot) return;

		const content = message.content.toLowerCase();

		// Regex for meow-like words
		const meowRegex = /(m+e+o+w+|m+e+w+|nya+)/i;

		if (meowRegex.test(content)) {
			message.reply("meow 🐱");
		}
	},
};
