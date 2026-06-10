const crypto = require("crypto");

module.exports = {
	path: "/login",
	method: "get",

	handler: (req, res) => {
		// Generate a random state to prevent CSRF on the OAuth callback
		const state = crypto.randomBytes(16).toString("hex");
		req.session.oauthState = state;

		const params = new URLSearchParams({
			client_id: process.env.DISCORD_CLIENT_ID,
			redirect_uri: `${process.env.BASE_URL}/auth/discord/callback`,
			response_type: "code",
			scope: "identify guilds",
			state,
		});

		return res.redirect(
			`https://discord.com/oauth2/authorize?${params.toString()}`,
		);
	},
};
