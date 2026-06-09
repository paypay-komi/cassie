const db = require("../../../db");

module.exports = {
	path: "/api/data/guild-commands",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		try {
			const disabled = await db.commandAccess.getGuildDisabled(guildId);
			const disabledSet = new Set(disabled.map((r) => r.commandId));

			// Get command tree from the client
			const client = req.app?.locals?.client;
			const commands = [];
			if (client?.textCommands) {
				const { getAllCommandIds, idToName } = require("../../../lib/commandResolver");
				const allIds = getAllCommandIds(client);
				for (const id of allIds) {
					const name = idToName(client, id);
					if (name) {
						commands.push({
							id,
							name,
							disabled: disabledSet.has(id),
						});
					}
				}
				commands.sort((a, b) => a.name.localeCompare(b.name));
			}

			return res.json({
				ok: true,
				commands,
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
