const { Client } = require("discord.js");

function walkTree(cmd) {
	const options = [];

	for (const sub of Object.values(cmd.subcommands)) {
		if (!sub.parentRef || sub.parentRef.name !== cmd.name) continue;

		const hasSubs = Object.keys(sub.subcommands).length > 0;

		options.push({
			name: sub.name,
			description: sub.description || "No description",
			type: hasSubs ? 2 : 1,
			options: hasSubs ? walkTree(sub) : [],
		});
	}

	return options;
}

module.exports = {
	name: "post commands to dbl",
	description: "posts all text commands to dbl",
	prerequisites: ["loadTextCommands", "initClientVars"],
	needsReadyClient: true,
	/**
	 * @param {Client} client
	 */
	async execute(client) {
		const commands = [];

		for (const cmd of client.textCommands.values()) {
			const hasSubs = Object.keys(cmd.subcommands).length > 0;

			commands.push({
				name: cmd.name,
				description: cmd.description || "No description",
				type: 1,
				options: hasSubs ? walkTree(cmd) : [],
			});
		}

		const res = await fetch(
			`https://discordbotlist.com/api/v1/bots/${client.user.id}/commands`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bot ${process.env.DBL_API_TOKEN}`,
				},
				body: JSON.stringify(commands),
			},
		);

		if (!res.ok) {
			console.error("Failed to post commands to DBL:", await res.text());
			return;
		}

		console.log(`Posted ${commands.length} commands to DBL`);
	},
};
