const { buildMessage } = require("../../../lib/v2Reply");
const starboard = require("../../../lib/starboard");

module.exports = {

commandId: "dd898e9e-2963-44a8-b93d-cab4fe50f0e8",
	name: "list",
	parent: "starboard",
	description: "List configured starboards",
	dmUse: false,

	async execute(message) {
		const prisma = message.client.db.prisma;
		const boards = await starboard.getBoards(prisma, message.guild.id);

		if (!boards.length)
			return message.reply(buildMessage("No starboards configured."));

		const lines = [
			"## ⭐ Starboards",
			...boards.map(
				(b) =>
					`**${b.emoji}** → <#${b.channelId}> · threshold ${b.threshold} · self-star ${
						b.selfStar ? "on" : "off"
					}`,
			),
		];
		return message.reply(buildMessage(lines.join("\n"), 0xffac33));
	},
};
