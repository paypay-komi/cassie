module.exports = {
	path: "/api/bot/avatar",
	method: "get",

	handler: async (req, res) => {
		try {
			const client = req.app?.locals?.client;
			if (!client?.user) {
				return res.status(503).json({ ok: false, error: "client not ready" });
			}

			const url = client.user.displayAvatarURL({ size: 512, extension: "png" });

			return res.json({ ok: true, url });
		} catch (err) {
			console.error(err);
			return res.status(500).json({ ok: false, error: "internal_error" });
		}
	},
};
