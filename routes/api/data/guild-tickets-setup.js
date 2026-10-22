const { ChannelType } = require("discord.js");
const db = require("../../../db");
const tickets = require("../../../lib/tickets");
const { requireGuildAccess } = require("../../../lib/guildGuard");
const { getLogger } = require("../../../lib/logger");

const log = getLogger("TicketSetupAPI");

module.exports = {
	path: "/api/data/guild-tickets-setup",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, categoryId } = req.body || {};
		if (!guildId) {
			return res.status(400).json({ ok: false, error: "missing guildId" });
		}

		const client = req.app?.locals?.client;
		if (!client) {
			return res.status(503).json({ ok: false, error: "bot_not_ready" });
		}

		const guard = await requireGuildAccess(req.session, guildId, client);
		if (!guard.ok) {
			return res.status(guard.status).json({ ok: false, error: guard.error });
		}

		try {
			const guild =
				client.guilds.cache.get(guildId) ||
				(await client.guilds.fetch(guildId).catch(() => null));
			if (!guild) {
				return res.status(404).json({ ok: false, error: "guild_not_found" });
			}

			let category = null;
			if (categoryId) {
				category =
					guild.channels.cache.get(categoryId) ||
					(await guild.channels.fetch(categoryId).catch(() => null));
				if (!category || category.type !== ChannelType.GuildCategory) {
					return res.status(400).json({ ok: false, error: "invalid_category" });
				}
			}

			const result = await tickets.setupGuild({
				client,
				guild,
				prisma: db.prisma,
				category,
			});

			return res.json({
				ok: true,
				summary: {
					guildId,
					categoryId: result.category.id,
					supportRoleId: result.supportRole.id,
					panelId: result.panel.id,
					panelChannelId: result.panelChannel.id,
					panelMessageId: result.panelMessage.id,
					optionId: result.option.id,
				},
			});
		} catch (err) {
			log.error("Ticket dashboard setup failed: " + err.message);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
