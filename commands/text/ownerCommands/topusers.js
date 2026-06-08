const { PermissionsBitField } = require("discord.js");

module.exports = {

commandId: "476758aa-746b-4d16-a3a6-8dd274980a8e",
	name: "topusers",
	aliases: ["activetop", "mostactive"],
	description: "Show the most active users by total command count.",
	permissions: ["botOwner"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
	],

	async execute(message, args) {
		const db = require("../../../db");

		const take = Math.min(parseInt(args[0]) || 20, 100);

		const top = await db.prisma.userGlobalCommandStats.groupBy({
			by: ["userId"],
			_sum: { count: true },
			orderBy: { _sum: { count: "desc" } },
			take,
		});

		if (!top.length) {
			return message.reply("No command stats recorded yet.");
		}

		// Try to resolve usernames from cache / fetch
		const lines = [];
		for (let i = 0; i < top.length; i++) {
			const { userId, _sum } = top[i];
			let name = userId;

			try {
				const user = await message.client.users.fetch(userId);
				if (user) name = `${user.tag} (${userId})`;
			} catch {
				name = userId;
			}

			lines.push(`**${i + 1}.** ${name} — **${_sum.count}** commands`);
		}

		// Split into chunks if needed (Discord 2000 char limit)
		const chunks = [];
		let current = "📊 **Most Active Users**\n\n";

		for (const line of lines) {
			const next = current + line + "\n";
			if (next.length > 1900) {
				chunks.push(current);
				current = line + "\n";
			} else {
				current = next;
			}
		}
		chunks.push(current);

		for (const chunk of chunks) {
			await message.channel.send(chunk);
		}
	},
};
