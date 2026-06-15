const { PermissionsBitField } = require("discord.js");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {

commandId: "564faca0-3656-4162-85ac-4214fdede30d",
	name: "cancel",
	description: "Cancel a pending time capsule",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	aliases: ["delete", "remove", "rm"],
	parent: "timecapsule",
	args: ArgsBuilder.create()
		.string("id", { required: true, description: "ID of the capsule to cancel" }),

	async execute(message, args) {
		const idArg = args[0];

		if (!idArg) {
			return message.reply("Please provide a capsule ID. Use `c.timecapsule list` to find it.");
		}

		// Allow partial ID matching (first 8+ chars)
		const capsule = await message.client.db.prisma.timeCapsule.findFirst({
			where: {
				userId: message.author.id,
				sentAt: null,
				id: { startsWith: idArg },
			},
		});

		if (!capsule) {
			return message.reply("No pending capsule found with that ID. Use `c.timecapsule list` to see your capsules.");
		}

		await message.client.db.prisma.timeCapsule.delete({
			where: { id: capsule.id },
		});

		await message.reply(
			`🗑️ Cancelled capsule **"${capsule.content.length > 50 ? capsule.content.slice(0, 50) + "…" : capsule.content}"** ` +
			`(scheduled for <t:${Math.floor(capsule.sendAt.getTime() / 1000)}:R>).`,
		);
	},
};
