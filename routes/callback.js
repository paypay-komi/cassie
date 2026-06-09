const axios = require("axios");

module.exports = {
	path: "/auth/discord/callback",
	method: "get",

	handler: async (req, res) => {
		const code = req.query.code;
		if (!code) return res.status(400).send("No code provided");

		try {
			// exchange code for access token
			const tokenRes = await axios.post(
				"https://discord.com/api/oauth2/token",
				new URLSearchParams({
					client_id: process.env.DISCORD_CLIENT_ID,
					client_secret: process.env.DISCORD_CLIENT_SECRET,
					grant_type: "authorization_code",
					code,
					redirect_uri: `${process.env.BASE_URL}/auth/discord/callback`,
				}),
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
				},
			);

			const accessToken = tokenRes.data.access_token;

			// fetch user
			const userRes = await axios.get(
				"https://discord.com/api/users/@me",
				{
					headers: {
						Authorization: `Bearer ${accessToken}`,
					},
				},
			);

			const user = userRes.data;

			// store session
			req.session.user = {
				id: user.id,
				username: user.username,
				avatar: user.avatar,
			};

			req.session.accessToken = accessToken;

			return res.redirect("/dashboard");
		} catch (err) {
			console.error("OAuth failed:", err);

			if (err.response?.status === 400) {
				return res.status(400).send("Invalid or expired code");
			}

			return res.status(500).send("OAuth failed");
		}
	},
};
