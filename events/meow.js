module.exports = {
	name: "messageCreate",
	description: "meows when message contains a meow-like word",

	execute(client, message) {
		// Ignore bots
		if (message.author.bot) return;

		const content = message.content.toLowerCase();

		// Regex for meow, mrrp, purr, kitty, nya
		const meowRegex = /m+e+o+w+|m+r+r+p+|p+u+r+r+|k+i+t+t+y+|n+y+a+/i;

		if (meowRegex.test(content)) {
			const responses = [
				"meow 🐱",
				"meow!",
				"meow~",
				"mew",
				"mew!",
				"mrrp",
				"mrrp?",
				"mrow",
				"mrrow~",
				"mrrow!",
				"mraow",
				"mrew",
				"mrr~",
				"mrp!",
				"mrp?",
				"meo?",
				"meep",
				"eeep?",
				"nya~",
				"nyaa~",
				"nyan~",
				"purrr",
				"prrr",
				"prrt!",
				"purr~",
				"meow meow",
				"meow meow!",
				"meow meow meow",
				"meow!!",
				"meeeow",
				"meeeeoooww",
				"mmeow",
				"mmrrp?",
				"mrow mrow",
				"mrrp mrrp",
				"*purrs*",
				"*swishes tail* meow",
				"*headbutts your hand* meow",
				"*leans in for pets* meow~",
				"*kneads the floor* purrr",
				"meow!! (that was an important announcement)",
				"mrrp? mrrp? are you talking to me?",
				"mew! mew!",
				"mrow... yes?",
				"prrrttt!",
				"meow 🐈",
				"meow ^^",
				"nya~ ♪",
				"meow meow meow meow!",
				"MEOW",
				"meow... (deep in thought)",
				"mrrrp mrrow",
				"purrrr meow",
				"mrow??",
				"*ears perk up* meow?",
				"meow :)",
			];
			message.reply({
				content: responses[Math.floor(Math.random() * responses.length)],
				allowedMentions: { repliedUser: false },
			});
		}
	},
};
