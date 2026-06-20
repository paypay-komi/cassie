const FALLBACK = "https://cdn.discordapp.com/embed/avatars/0.png";

module.exports = {
	path: "/api/bot/avatar",
	method: "get",

	handler: async (req, res) => {
		try {
			const client = req.app?.locals?.client;
			const url =
				client?.user?.displayAvatarURL({
					size: 512,
					extension: "png",
				}) || FALLBACK;

			if (req.query.redirect) {
				return res.redirect(url);
			}

			// Proxy image bytes at 200 so Discord embeds work
			const resp = await fetch(url);
			if (!resp.ok) {
				return res.redirect(FALLBACK);
			}
			res.set(
				"Content-Type",
				resp.headers.get("content-type") || "image/png",
			);
			res.set("Cache-Control", "public, max-age=86400");
			resp.body.pipe(res);
		} catch (err) {
			console.error(err);
			res.redirect(FALLBACK);
		}
	},
};
