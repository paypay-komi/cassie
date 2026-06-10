const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { getLogger } = require("../../../lib/logger");
const log = getLogger("GuildCmdToggle");

module.exports = {
	path: "/api/data/guild-command-toggle",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, commandId, disabled } = req.body || {};
		if (!guildId || !commandId) {
			return res.status(400).json({ ok: false, error: "missing guildId or commandId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const client = req.app?.locals?.client;
			const toggled = [commandId];
			const subIds = [];

			// When disabling a parent command, also disable all its subcommands
			if (client?.textCommands) {
				const { getSubcommandIds } = require("../../../lib/commandResolver");
				subIds.push(...getSubcommandIds(client, commandId));
				toggled.push(...subIds);
			}

			// Apply toggle to all affected commands
			for (const id of toggled) {
				await db.commandAccess.setGuildDisabled(guildId, id, !!disabled);
			}

			const extra = subIds.length > 0 ? ` + ${subIds.length} subcommand(s)` : "";
			log.info(`guild=${guildId} cmd=${commandId} disabled=${!!disabled}${extra}`);
			if (subIds.length > 0) {
				log.info(`cascaded IDs: ${subIds.join(', ')}`);
			}
			return res.json({ ok: true, extra: subIds });
		} catch (err) {
			log.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
