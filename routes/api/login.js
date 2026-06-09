module.exports = {
	path: "/login",
	method: "get",

	handler: (req, res) => {
		const params = new URLSearchParams({
			client_id: process.env.DISCORD_CLIENT_ID,
			redirect_uri: `${process.env.BASE_URL}/auth/discord/callback`,
			response_type: "code",
			scope: "identify guilds",
		});

		return res.redirect(
			`https://discord.com/oauth2/authorize?${params.toString()}`,
		);
	},
};
