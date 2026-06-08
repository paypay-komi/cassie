const {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	MessageFlags,
} = require("discord.js");
const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "courtCaseResolver",
	description: "Closes expired court cases and announces results",
	reloadAble: true,
	timer: null,
	needsReadyClient: true,
	async execute(client) {
		const log = getLogger("CourtCase");

		// Only run on shard 0 to prevent duplicate case resolution
		if (client.shard && client.shard.ids[0] !== 0) {
			log.info("Not shard 0, skipping court case resolver");
			return;
		}

		const runTask = async () => {
			try {
				const db = require("../../db");

				// ─── Close expired cases ──────────────────────
				const expired = await db.prisma.courtCase.findMany({
					where: {
						status: "VOTING",
						voteDeadline: { lte: new Date() },
					},
					include: { votes: true },
				});

				for (const courtCase of expired) {
					try {
						let guilty = 0;
						let notGuilty = 0;

						for (const vote of courtCase.votes) {
							if (vote.value === 1) guilty++;
							else if (vote.value === -1) notGuilty++;
						}

						const newStatus =
							guilty > notGuilty ? "GUILTY" : "NOT_GUILTY";

						await db.prisma.courtCase.update({
							where: { id: courtCase.id },
							data: {
								status: newStatus,
								closedAt: new Date(),
							},
						});

						// Edit the original message with the verdict
						if (courtCase.messageId && courtCase.channelId) {
							try {
								const channel = await client.channels.fetch(
									courtCase.channelId,
								);
								if (channel) {
									const msg = await channel.messages.fetch(
										courtCase.messageId,
									);
									if (msg) {
										const caseNumber = courtCase.id
											.slice(0, 8)
											.toUpperCase();
										const totalVotes =
											guilty + notGuilty;
										const verdictColor =
											newStatus === "GUILTY"
												? 0xe74c3c
												: 0x2ecc71;
										const verdictEmoji =
											newStatus === "GUILTY"
												? "🔴"
												: "🟢";

										const container =
											new ContainerBuilder()
												.setAccentColor(
													verdictColor,
												)
												.addTextDisplayComponents(
													new TextDisplayBuilder().setContent(
														`# ⚖️ Case #${caseNumber} — CLOSED`,
													),
												)
												.addSeparatorComponents(
													new SeparatorBuilder()
														.setDivider(true)
														.setSpacing(
															SeparatorSpacingSize.Small,
														),
												)
												.addTextDisplayComponents(
													new TextDisplayBuilder().setContent(
														[
															`${verdictEmoji} **Verdict: ${newStatus}**`,
															`🗳️ **${totalVotes}** vote(s) cast`,
															`🔴 Guilty: **${guilty}**`,
															`🟢 Not Guilty: **${notGuilty}**`,
															"",
															`👤 Defendant: <@${courtCase.defendantId}>`,
															`🛡️ Prosecutor: <@${courtCase.prosecutorId}>`,
															`📋 **Reason**`,
															`\`\`\`${courtCase.reason}\`\`\``,
														].join("\n"),
													),
												);

										await msg.edit({
											components: [container],
											flags: MessageFlags.IsComponentsV2,
										});
									}
								}
							} catch (msgErr) {
								log.warn(
									`Could not update case message ${courtCase.messageId}: ${msgErr.message}`,
								);
							}
						}

						log.info(
							`Case #${courtCase.id.slice(0, 8).toUpperCase()} closed: ${newStatus} (${guilty}-${notGuilty})`,
						);
					} catch (caseErr) {
						log.error(
							`Failed to resolve case ${courtCase.id}:`,
							caseErr,
						);
					}
				}

				// ─── Schedule next check at the next deadline ──
				const nextCase = await db.prisma.courtCase.findFirst({
					where: {
						status: "VOTING",
						voteDeadline: { gte: new Date() },
					},
					orderBy: { voteDeadline: "asc" },
				});

				if (nextCase) {
					const delay =
						new Date(nextCase.voteDeadline) - new Date();
					this.timer = setTimeout(runTask, delay);
					log.info(
						`Next case deadline in ${Math.round(delay / 1000)}s`,
					);
				}
			} catch (err) {
				log.error("Court resolver error:", err);
			}
		};

		runTask();
		log.info("✅ Court case resolver started");
	},
	cleanUp() {
		if (this.timer) clearTimeout(this.timer);
	},
	recheck() {
		this.cleanUp();
		this.execute();
	},
};
