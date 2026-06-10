const { isAsyncFunction } = require("node:util/types");
const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { isCommandVisible } = require("../../../lib/commandResolver");
function findCommandNode(client, commandId) {
	function search(node) {
		if (node.commandId === commandId) return node;
		for (const sub of Object.values(node.subcommands || {})) {
			const found = search(sub);
			if (found) return found;
		}
		return null;
	}

	for (const cmd of client.textCommands.values()) {
		const found = search(cmd);
		if (found) return found;
	}
	return null;
}

module.exports = {
	path: "/api/data/guild-commands",
	method: "get",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const guildId = req.query.guildId;
		if (!guildId) {
			return res
				.status(400)
				.json({ ok: false, error: "missing guildId" });
		}

		const guard = await requireGuildAccess(
			req.session,
			guildId,
			req.app?.locals?.client,
		);

		if (!guard.ok) {
			return res
				.status(guard.status)
				.json({ ok: false, error: guard.error });
		}

		try {
			const client = req.app?.locals?.client;

			const disabled = await db.commandAccess.getGuildDisabled(guildId);
			const disabledSet = new Set(disabled.map((r) => r.commandId));

			const commands = [];

			if (client?.textCommands) {
				for (const cmd of client.textCommands.values()) {
					for (const node of Object.values(cmd.subcommands || {})) {
						// recursive flatten using IDs inside tree
						collectNodes(node, commands, disabledSet, client);
					}

					// include root command itself
					if (cmd.commandId) {
						const root = cmd;

						if (!isCommandVisible(root)) continue;
						commands.push({
							id: root.commandId,
							name: root.name,
							disabled: disabledSet.has(root.commandId),
							parentId: root.parentRef?.commandId || null,
							hasSubcommands:
								Object.keys(root.subcommands || {}).length > 0,
						});
					}
				}
			}

			commands.sort((a, b) => a.name.localeCompare(b.name));

			return res.json({
				ok: true,
				commands,
				debug: {
					disabledCount: disabled.length,
					disabledIds: disabled.map((r) => r.commandId),
				},
			});
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};

function collectNodes(node, out, disabledSet) {
	if (!node) return;

	if (!isCommandVisible(node)) return;

	out.push({
		id: node.commandId,
		name: node.name,
		disabled: disabledSet.has(node.commandId),
		parentId: node.parentRef?.commandId || null,
		hasSubcommands: Object.keys(node.subcommands || {}).length > 0,
		ownerOnly: node.permissions?.includes("botOwner") || false,
	});

	for (const sub of Object.values(node.subcommands || {})) {
		collectNodes(sub, out, disabledSet);
	}
}
