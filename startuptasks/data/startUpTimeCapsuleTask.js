const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "startUpTimeCapsuleTask",
	description: "Deliver time capsules on schedule",
	reloadAble: true,
	timer: null,

	async execute(client) {
		const log = getLogger("TimeCapsuleTask");

		const runTask = async () => {
			const now = new Date();
			const capsules = await client.db.prisma.timeCapsule.findMany({
				where: {
					sendAt: { lte: now },
					sentAt: null,
				},
			});

			await Promise.all(
				capsules.map(async (capsule) => {
					try {
						const user = await client.users.fetch(capsule.userId);
						await user.send(
							`📬 **Your time capsule has arrived!**\n\n${capsule.content}\n\n-# Sent ${capsule.createdAt ? `<t:${Math.floor(capsule.createdAt.getTime() / 1000)}:R>` : "a while ago"} — scheduled to arrive <t:${Math.floor(capsule.sendAt.getTime() / 1000)}:R>`,
						);
					} catch (err) {
						log.error(
							`Failed to deliver capsule ${capsule.id} to ${capsule.userId}:`,
							err,
						);
					}

					// Mark as sent regardless of DM success to prevent retry spam
					return client.db.prisma.timeCapsule.update({
						where: { id: capsule.id },
						data: { sentAt: now },
					});
				}),
			);

			// Schedule next check
			const nextCapsule = await client.db.prisma.timeCapsule.findFirst({
				where: { sentAt: null },
				orderBy: { sendAt: "asc" },
			});

			if (nextCapsule) {
				const delay = new Date(nextCapsule.sendAt) - new Date();
				this.timer = setTimeout(runTask, Math.max(1000, delay));
			} else {
				this.timer = setTimeout(runTask, 60 * 1000);
			}
		};

		runTask();
		log.info("✅ Time capsule delivery task started");
	},

	cleanUp(client) {
		if (this.timer) clearTimeout(this.timer);
	},

	recheck(CLIENT) {
		this.cleanUp(CLIENT);
		this.execute(CLIENT);
	},
};
