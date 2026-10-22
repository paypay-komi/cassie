const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-echo-chamber-delete",
	method: "post",

	handler: async (req, res) => {
		if (!req.session?.user) {
			return res.status(401).json({ ok: false, error: "unauthorized" });
		}

		const { guildId, channelId } = req.body;
		if (!guildId || !channelId) {
			return res.status(400).json({ ok: false, error: "missing guildId or channelId" });
		}

		const guard = await requireGuildAccess(req.session, guildId, req.app?.locals?.client);
		if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });

		try {
			const channel = await db.prisma.echoChannel.findFirst({
				where: { channelId, guildId },
			});

			if (!channel) {
				return res.status(404).json({ ok: false, error: "echo chamber not found" });
			}

			try {
				const client = req.app?.locals?.client;
				const guild = await client.guilds.fetch(guildId);
				if (guild) {
					const ch = await guild.channels.fetch(channelId);
					if (ch) {
						const webhook = await ch.fetchWebhook(channel.webhookId).catch(() => null);
						if (webhook) await webhook.delete().catch(() => {});
					}
				}
			} catch {
				// webhook might already be deleted, that's fine
			}

			await db.prisma.echoMessage.deleteMany({
				where: { channelId },
			});

			await db.prisma.echoChannel.delete({
				where: { id: channel.id },
			});

			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
