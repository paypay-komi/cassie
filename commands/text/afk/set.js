const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	MessageFlags,
	time,
} = require("discord.js");
const db = require("../../../db");
const { ArgsBuilder } = require("../../../lib/argsBuilder");
module.exports = {
	commandId: "11f5a84f-03cb-4c50-b90f-effb9d3580fa",
	name: "set",
	description: "sets your afk optional message arg",
	args: ArgsBuilder.create()
		.string("message", { description: "AFK message" }),
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	parent: "afk",
	
	async execute(message, args) {
		const reason = args.join(" ").trim() || "No reason — just AFK";
		// Normalize args for slash compatibility (ArgsBuilder string)
		const dbReason = args.join(" ") || "this user is afk";
		await db.prisma.globalAfkUser.upsert({
			create: {
				userId: message.author.id,
				reason: dbReason,
			},
			update: {
				reason: dbReason,
			},
			where: {
				userId: message.author.id,
			},
		});
		const db_data = await db.prisma.globalAfkUser.findFirst({
			where: {
				userId: message.author.id,
			},
		});
		message.client.afk.set(message.author.id, db_data);

		const since = db_data?.since ? new Date(db_data.since) : new Date();
		const container = new ContainerBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`## 💤 You're now AFK, ${message.author.displayName || message.author.username}`),
			)
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`**Reason:** ${reason.slice(0, 1500)}`),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`**Since:** ${time(since)} (${time(since, "R")})`),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`-# Anyone who mentions you will be told you're AFK. I'll keep track of who pinged you.\n-# Send any message and choose **Remove** or use \`c.afk remove\` to return — I'll show who mentioned you, when, links, and how long you were gone.`,
				),
			);
		container.setAccentColor(0x5865f2);

		await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	},
};
