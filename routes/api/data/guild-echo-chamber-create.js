const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
const { requireGuildAccess } = require("../../../lib/guildGuard");

module.exports = {
	path: "/api/data/guild-echo-chamber-create",
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
			const client = req.app?.locals?.client;
			const guild = await client.guilds.fetch(guildId);
			if (!guild) return res.status(404).json({ ok: false, error: "guild not found" });

			const channel = await guild.channels.fetch(channelId);
			if (!channel || !channel.isTextBased()) {
				return res.status(400).json({ ok: false, error: "channel not found or not a text channel" });
			}

			const botMember = await guild.members.fetch(client.user.id);
			const required = [
				PermissionsBitField.Flags.SendMessages,
				PermissionsBitField.Flags.ReadMessageHistory,
				PermissionsBitField.Flags.ManageMessages,
				PermissionsBitField.Flags.ManageWebhooks,
			];
			const missing = required.filter(p => !botMember.permissions.has(p));
			if (missing.length > 0) {
				return res.status(403).json({ ok: false, error: "bot missing permissions" });
			}

			const existing = await db.prisma.echoChannel.findFirst({
				where: { channelId },
			});
			if (existing) {
				return res.status(409).json({ ok: false, error: "channel is already an echo chamber" });
			}

			const webhook = await channel.createWebhook({ name: "Echo Chamber" });
			await db.prisma.echoChannel.create({
				data: {
					channelId,
					guildId,
					webhookId: webhook.id,
					webhookToken: webhook.token,
				},
			});

			return res.json({ ok: true });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
