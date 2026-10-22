module.exports = {
	path: "/api/landing-commands",
	method: "get",

	handler: async (req, res) => {
		const client = req.app?.locals?.client;
		if (!client?.textCommands?.size) {
			return res.status(503).json({ ok: false, error: "not_ready" });
		}

		try {
			const commands = {};

			for (const [name, cmd] of client.textCommands) {
				(function recurse(node, commandPath) {
					if (node.commandId) commands[node.commandId] = commandPath;
					for (const [subName, sub] of Object.entries(
						node.subcommands || {},
					)) {
						if (sub.parentRef === node) {
							recurse(sub, `${commandPath} ${subName}`);
						}
					}
				})(cmd, name);
			}

			return res.json({
				ok: true,
				prefix: "c.",
				commands,
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
