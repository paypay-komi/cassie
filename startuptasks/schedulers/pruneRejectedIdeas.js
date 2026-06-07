const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "pruneRejectedIdeas",
	description: "Deletes rejected ideas older than 7 days (every hour)",
	reloadAble: true,
	timer: null,
	prerequisites: ["startPrisma"],
	async execute() {
		const log = getLogger("PruneIdeas");
		const runTask = async () => {
			const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

			const { prisma } = require("../../db");

			const { count } = await prisma.idea.deleteMany({
				where: {
					status: "rejected",
					rejectedAt: { lte: weekAgo },
				},
			});

			if (count > 0) {
				log.info(
					`🧹 Pruned ${count} rejected idea(s) older than 7 days`,
				);
			}

			this.timer = setTimeout(runTask, 60 * 60 * 1000);
		};

		runTask();
		log.info("✅ Rejected idea pruning task started (every hour)");
	},
	cleanUp() {
		if (this.timer) clearTimeout(this.timer);
	},
	recheck() {
		this.cleanUp();
		this.execute();
	},
};
