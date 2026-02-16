module.exports = {
	name: "startUpReminderTask",
	description: "Start the reminder task on startup",
	reloadAble: true,
	timer: null,
	async execute(client) {
		const runTask = async () => {
			const now = new Date();
			const reminders = await client.db.prisma.reminder.findMany({
				where: { remindAt: { lte: now } },
			});

			await Promise.all(
				reminders.map(async (reminder) => {
					try {
						const user = await client.users.fetch(reminder.userId);
						await user.send(`⏰ Reminder: ${reminder.content}`);
						await client.db.prisma.reminder.delete({
							where: { id: reminder.id },
						});
					} catch (err) {
						console.error(
							`Failed to send reminder to ${reminder.userId}:`,
							err,
						);
					}
				}),
			);

			const nextReminder = await client.db.prisma.reminder.findFirst({
				orderBy: { remindAt: "asc" },
			});

			if (nextReminder) {
				const delay = new Date(nextReminder.time) - new Date();
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
};
