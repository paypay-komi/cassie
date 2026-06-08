/**
 * List all available text commands and their descriptions.
 */
module.exports = {
	name: "commands",
	description: "List all available commands.",

	async execute(message) {
		const entries = [];

		for (const cmd of message.client.textCommands.values()) {
			(function walk(node, prefix) {
				const pathName = prefix || node.name;
				const desc = node.description || "";
				entries.push({ path: pathName, desc });

				for (const sub of Object.values(node.subcommands || {})) {
					if (sub.parentRef === node) {
						walk(sub, `${pathName} ${sub.name}`);
					}
				}
			})(cmd, "");
		}

		if (!entries.length) {
			return message.reply("No commands available.");
		}

		// Format: one per line with description
		const lines = entries.map((e) => {
			const padded = `\`${e.path.padEnd(28)}\``;
			return `${padded} ${e.desc}`;
		});

		let current = "📋 **Available Commands**\n\n";
		for (const line of lines) {
			const next = current + line + "\n";
			if (next.length > 1900) {
				await message.channel.send(current);
				current = line + "\n";
			} else {
				current = next;
			}
		}
		await message.channel.send(current);
	},
};
