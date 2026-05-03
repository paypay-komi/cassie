const db = require("../../../db/boobs.js");
const {
	validateIdea,
	bustIdeaCache,
} = require("../../../utils/ideas/validateIdea.js");

module.exports = {
	name: "add",
	description: "adds an idea to the idea board",
	parent: "idea",

	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const idea = args.join(" ").trim();
		if (!idea)
			return message.reply(
				"must enter an idea e.g. `c.idea add random quote fetcher`",
			);
		if (idea.length < 20)
			return message.reply("idea must be at least 20 characters");

		const validation = await validateIdea(idea);

		if (validation.result === "rejected") {
			await db.prisma.idea
				.create({
					data: {
						authorId: message.author.id,
						content: idea,
						status: "rejected",
						rejectReason:
							validation.reason ?? "failed automated screening",
						rejectedBy: "auto",
						rejectedAt: new Date(),
						spamScore: validation.reason ?? null,
					},
				})
				.catch((err) =>
					console.error("failed to save rejected idea:", err),
				);

			return message.reply(`❌ idea rejected: ${validation.reason}`);
		}

		const status =
			validation.result === "approved" ? "approved" : "pending";

		try {
			await db.prisma.idea.create({
				data: {
					authorId: message.author.id,
					content: idea,
					status,
					spamScore: validation.reason ?? null,
					...(status === "approved" && {
						approvedBy: "auto",
						approvedAt: new Date(),
					}),
				},
			});

			if (status === "approved") {
				message.reply("✅ idea submitted and approved!");
			} else {
				message.reply(
					`⏳ idea submitted but is pending mod review${validation.reason ? `: ${validation.reason}` : ""}!`,
				);
			}
			bustIdeaCache();
		} catch (err) {
			console.error(err);
			message.reply("failed to submit idea, try again later");
		}
	},
};
