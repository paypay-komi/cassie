const { getLogger } = require("../../lib/logger");
const db = require("../../db");

module.exports = {
	name: "initVoteReminders",
	description: "Reschedules persisted vote reminders after restart (no data loss)",
	needsReadyClient: true,
	async execute(client) {
		const log = getLogger("VoteReminders");
		try {
			const pending = await db.prisma.voteReminder.findMany({
				orderBy: { remindAt: "asc" },
			});
			if (!pending.length) {
				log.info("No pending vote reminders to reschedule.");
				return;
			}
			// Lazy-load scheduler from handler (avoid circular at top)
			let scheduleVoteReminder;
			try {
				({ scheduleVoteReminder } = require("../../events/voteRemindHandler"));
			} catch {}
			if (typeof scheduleVoteReminder !== "function") {
				log.error("scheduleVoteReminder not found — cannot reschedule.");
				return;
			}
			let scheduled = 0;
			let expired = 0;
			for (const r of pending) {
				const msUntil = new Date(r.remindAt).getTime() - Date.now();
				if (msUntil <= 0) {
					// If overdue by <7 days, fire now via schedule (ms=0 will fire ASAP)
					if (msUntil > -7 * 24 * 60 * 60 * 1000) {
						await scheduleVoteReminder(client, r.userId, new Date(Date.now() + 1000));
						// Update DB to now+1s to avoid tight loop
						await db.prisma.voteReminder.update({ where: { userId: r.userId }, data: { remindAt: new Date(Date.now() + 1000) } }).catch(() => {});
						scheduled++;
					} else {
						// Too old, clean up
						await db.prisma.voteReminder.delete({ where: { userId: r.userId } }).catch(() => {});
						expired++;
					}
					continue;
				}
				await scheduleVoteReminder(client, r.userId, r.remindAt);
				scheduled++;
			}
			log.info(`✅ Rescheduled ${scheduled} vote reminders (cleaned ${expired} expired)`);
		} catch (err) {
			const log2 = getLogger("VoteReminders");
			log2.error("Failed to reschedule vote reminders:", err);
		}
	},
};
