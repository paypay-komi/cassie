const crypto = require("crypto");
const db = require("../db");
const { PermissionsBitField } = require("discord.js");

module.exports = {
	path: "/invite",
	method: "get",

	handler: async (req, res) => {
		const BOT_PERMS = [
			PermissionsBitField.Flags.CreateInstantInvite,
			PermissionsBitField.Flags.ViewChannel,
			PermissionsBitField.Flags.SendMessages,
			PermissionsBitField.Flags.ManageMessages,
			PermissionsBitField.Flags.EmbedLinks,
			PermissionsBitField.Flags.AttachFiles,
			PermissionsBitField.Flags.ReadMessageHistory,
			PermissionsBitField.Flags.MentionEveryone,
			PermissionsBitField.Flags.UseExternalEmojis,
			PermissionsBitField.Flags.ManageWebhooks,
			PermissionsBitField.Flags.SendMessagesInThreads,
			PermissionsBitField.Flags.CreatePublicThreads,
			PermissionsBitField.Flags.CreatePrivateThreads,
		];
		const defaultPerms = BOT_PERMS.reduce((a, b) => a | b, 0n);
		let state;
		try {
			// Clean up stale unmatched clicks older than 1 hour
			try {
				const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
				await db.prisma.inviteClick.deleteMany({
					where: { guildId: null, createdAt: { lt: oneHourAgo } },
				});
			} catch {}

			const ref = (req.query.ref || "").trim().slice(0, 100) || "unknown";
			const ip =
				req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
				req.socket?.remoteAddress ||
				null;
			const userAgent =
				(req.headers["user-agent"] || "").slice(0, 300) || null;

			// Generate a state parameter for OAuth2 callback tracking
			state = crypto.randomUUID();
			await db.prisma.inviteClick.create({
				data: { ref, ip, userAgent, state },
			});

			const client = req.app?.locals?.client;
			const clientId = client?.user?.id || "1461183051949412384";
			const perms = parseInt(req.query.perms, 10);
			const permInt =
				!isNaN(perms) && perms >= 0 ? perms : Number(defaultPerms);
			const guildId = req.query.guild_id || "";
			const guildParam = guildId ? `&guild_id=${encodeURIComponent(guildId)}` : "";
			const baseUrl = process.env.BASE_URL || `https://nekomi.tailef6033.ts.net`;
			const redirectUri = `${baseUrl}/invite/callback`;
			const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permInt}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=bot%20applications.commands&response_type=code&state=${state}${guildParam}`;

			res.redirect(302, inviteUrl);
		} catch (err) {
			console.error(err);

			const clientId =
				req.app?.locals?.client?.user?.id || "1461183051949412384";
			const perms = parseInt(req.query.perms, 10);
			const permInt =
				!isNaN(perms) && perms >= 0 ? perms : Number(defaultPerms);
			const guildId = req.query.guild_id || "";
			const guildParam = guildId ? `&guild_id=${encodeURIComponent(guildId)}` : "";
			const baseUrl = process.env.BASE_URL || `https://nekomi.tailef6033.ts.net`;
			const redirectUri = `${baseUrl}/invite/callback`;
			const stateParam = state ? `&state=${state}` : "";
			res.redirect(
				302,
				`https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permInt}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=bot%20applications.commands&response_type=code${stateParam}${guildParam}`,
			);
		}
	},
};
