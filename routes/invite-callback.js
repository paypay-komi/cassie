const { getLogger } = require("../lib/logger");
const db = require("../db");

const log = getLogger("InviteCallback");

module.exports = {
	path: "/invite/callback",
	method: "get",

	handler: async (req, res) => {
		const state = req.query.state;
		const guildId = req.query.guild_id;
		const error = req.query.error;

		if (!state) {
			return res.redirect("/");
		}

		try {
			const click = await db.prisma.inviteClick.findUnique({
				where: { state },
			});

			if (!click) {
				log.warn(`Invite callback with unknown state: ${state}`);
				return res.redirect("/");
			}

			if (error) {
				log.info(
					`Invite click ${click.id} (ref: ${click.ref}) cancelled: ${error}`,
				);
				return res.redirect("/");
			}

			if (guildId) {
				await db.prisma.inviteClick.update({
					where: { id: click.id },
					data: { guildId, matchedAt: new Date() },
				});
				log.info(
					`Matched invite click ${click.id} (ref: ${click.ref}) to guild ${guildId} via redirect callback`,
				);
			}
		} catch (err) {
			log.warn(`Invite callback error: ${err.message}`);
		}

		res.redirect("/thank-you");
	},
};
