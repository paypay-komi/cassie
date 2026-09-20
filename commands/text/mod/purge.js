const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");

module.exports = {

commandId: "79a260ea-3cef-47ce-be5a-450c9ad868ab",
	name: "purge",
	parent: "mod",
	description: "Bulk delete messages (optionally from one user)",
	usage: "mod purge <1-100> or mod purge <@user> <1-100>",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageMessages],

	async execute(message, args) {
		const target = message.mentions.users.first();
		const amountArgs = args.filter((a) => /^\d+$/.test(a));
		const amount = amountArgs.length ? Math.min(Math.max(parseInt(amountArgs[0], 10), 1), 100) : 50;

		if (target) {
			await message.delete().catch(() => {});
			const channel = message.channel;
			let fetched = 0;
			while (fetched < amount) {
				const batch = await channel.messages.fetch({ limit: Math.min(amount - fetched, 100) }).catch(() => new Map());
				const toDelete = [...batch.values()].filter((m) => m.author.id === target.id);
				if (!toDelete.length) break;
				await channel.bulkDelete(toDelete).catch(() => {});
				fetched += toDelete.length;
			}
			return message.reply(buildMessage(`🗑️ Deleted up to ${amount} messages from <@${target.id}>.`, 0x5865f2));
		}

		await message.delete().catch(() => {});
		await message.channel.bulkDelete(amount).catch((err) =>
			message.reply(buildMessage(`Failed to purge: ${err.message}`, 0xe05252)),
		);
		return message.channel
			.send(buildMessage(`🗑️ Purged ${amount} messages.`, 0x5865f2))
			.then((m) => setTimeout(() => m.delete().catch(() => {}), 4000));
	},
};