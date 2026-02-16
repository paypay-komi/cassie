module.exports = {
	name: 'list',
	description: 'List all your reminders',
	aliases: ['ls', 'l'],
	parent: 'reminders',
	async execute(message, args) {
		const userId = message.author.id;
		const reminders = await message.client.db.prisma.reminder.findMany({
			where: { userId },
			orderBy: { remindAt: 'asc' },
		});
		if (reminders.length === 0) {
			return message.reply('You have no reminders set.');
		}
		const embed = EmbedBuilder()
			.setTitle(`${message.author.username}'s Reminders`)
			.setColor('#0099ff')
			.setDescription(reminders.map((reminder, index) => {
				const timeUntil = Math.round((reminder.remindAt.getTime() - Date.now()) / 60000);
				return `**${index + 1}.** ${reminder.content} - in ${timeUntil} minutes`;
			}).join('\n'));
		message.reply({ embeds: [embed] });
	}
};
