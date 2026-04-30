const db = require("../db/boobs.js");
module.exports = {
	name: "startUpReminderTask",
	description: "Start the reminder task on startup",
	reloadAble: true,
	timer: null,
	async execute(client) {
		const runTask = async () => {
			const now = new Date();
			const reminders = await db.prisma.reminder.findMany({
				where: { remindAt: { lte: now } },
			});

			await Promise.all(
				reminders.map(async (reminder) => {
					try {
						if (reminder.remindInChannel && reminder.channelId) {
							const channel = await client.channels.fetch(
								reminder.channelId,
							);
							if (channel) {
								await channel.send(
									`⏰ Reminder for <@${reminder.userId}>: ${reminder.content}`,
								);
							} else {
								console.warn(
									`Could not find channel ${reminder.channelId} to send reminder for user ${reminder.userId}.`,
								);
							}
						} else {
							const user = await client.users.fetch(
								reminder.userId,
							);
							await user.send(`⏰ Reminder: ${reminder.content}`);
						}
					} catch (err) {
						console.error(
							`Failed to send reminder to ${reminder.userId}:`,
							err,
						);
					}

					if (!reminder.repeatingSecs) {
						// delete no matter what to prevent stuck reminders, even if sending fails
						return db.prisma.reminder.delete({
							where: {
								id: reminder.id,
							},
						});
					}
					return db.prisma.reminder.update({
						where: { id: reminder.id },
						data: {
							remindAt: Date.now() + reminder.repeatingSecs,
						},
					});
				}),
			);

			const nextReminder = await client.db.prisma.reminder.findFirst({
				orderBy: { remindAt: "asc" },
			});

			if (nextReminder) {
				const delay = new Date(nextReminder.remindAt) - new Date();
				this.timer = setTimeout(runTask, delay);
			} else {
				this.timer = setTimeout(runTask, 60 * 1000); // Check again in 1 min if no reminders
			}
		};

		runTask();
		console.log("✅ Reminder task started on startup");
	},
	cleanUp(client) {
		if (this.timer) clearTimeout(this.timer);
	},
	recheck(CLIENT) {
		this.cleanUp(CLIENT);
		this.execute(CLIENT);
	},
};
