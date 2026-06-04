const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const db = require("../../../db");
const {
	validateIdea,
	bustIdeaCache,
} = require("../../../utils/ideas/validateIdea.js");

module.exports = {
	name: "add",
	description: "adds an idea to the idea board",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	parent: "idea",

	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const log = getLogger("AddIdea");
		const idea = args.join(" ").trim();
		if (!idea)
			return message.reply(
				"must enter an idea e.g. `c.idea add random quote fetcher`",
			);

		const thinking = await message.reply("🤔 thinking...");

		let validation;
		try {
			validation = await validateIdea(idea);
		} catch (err) {
			log.error("Idea validation error:", err);
			return thinking.edit("❌ error validating idea, try again later");
		}

		const aiData = {
			aiResult: validation.result ?? null,
			aiReason: validation.reason ?? null,
			aiThoughts: validation.thoughts ?? null,
			aiConfidence: validation.confidence ?? null,
			aiCategory: validation.category ?? null,
			aiImprovedIdea: validation.improved_idea ?? null,
			aiDuplicateOf: validation.duplicate_of ?? null,
		};

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
						...aiData,
					},
				})
				.catch((err) =>
					log.error("failed to save rejected idea:", err),
				);

			let replyMsg = `❌ idea rejected: ${validation.reason}`;
			if (validation.duplicate_of)
				replyMsg += `\nalready suggested: *${validation.duplicate_of}*`;
			if (validation.improved_idea)
				replyMsg += `\ntry something like: *${validation.improved_idea}*`;

			return thinking.edit(replyMsg);
		}

		const status =
			validation.result === "approved" ? "approved" : "pending";

		try {
			await db.prisma.idea.create({
				data: {
					authorId: message.author.id,
					content: idea,
					status,
					...aiData,
					...(status === "approved" && {
						approvedBy: "auto",
						approvedAt: new Date(),
					}),
				},
			});

			if (status === "approved") {
				thinking.edit("✅ idea submitted and approved!");
			} else {
				thinking.edit(
					`⏳ idea submitted but is pending mod review${validation.reason ? `: ${validation.reason}` : ""}!`,
				);
			}

			bustIdeaCache();
		} catch (err) {
			log.error("Error submitting idea:", err);
			thinking.edit("failed to submit idea, try again later");
		}	
	},
};
