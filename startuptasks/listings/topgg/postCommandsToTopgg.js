const { getLogger } = require("../../../lib/logger");

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

async function postCommandsToTopgg(client) {
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

	const res = await fetch("https://top.gg/api/v1/projects/@me/commands", {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.TOPGG_TOKEN}`,
		},
		body: JSON.stringify(commands),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "unknown error");
		throw new Error(`top.gg returned ${res.status}: ${text.slice(0, 200)}`);
	}

	return commands.length;
}

module.exports = {
	name: "post commands to top.gg",
	description: "posts all text commands to top.gg",
	prerequisites: ["loadTextCommands", "initClientVars"],
	needsReadyClient: true,

	async execute(client) {
		const log = getLogger("TopGG");
		if (!process.env.TOPGG_TOKEN) {
			log.warn("[Top.gg] No TOPGG_TOKEN set — skipping command posting");
			return;
		}

		try {
			const count = await postCommandsToTopgg(client);
			log.info(`[Top.gg] Posted ${count} commands to top.gg`);
		} catch (err) {
			log.error("[Top.gg] Failed to post commands:", err.message);
		}
	},
};
