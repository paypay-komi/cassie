module.exports = {
	path: "/api/data/user",
	method: "get",

	handler: async (req, res) => {
		const session = req.session;

		if (!session?.user) {
			return res.status(401).json({
				ok: false,
				error: "unauthorized",
			});
		}

		return res.json({
			ok: true,
			id: session.user.id,
			username: session.user.username,
			avatar: session.user.avatar,
		});
	},
};
