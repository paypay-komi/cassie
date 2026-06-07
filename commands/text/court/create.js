const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
} = require("discord.js");
const parseTime = require("../../../utils/parseTime");
const courtCaseResolver = require("../../../startuptasks/schedulers/courtCaseResolver.js");

module.exports = {
	name: "create",
	description: "create a court case",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "court",
	aliases: ["make"],
	dmUse: false,
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */

	async execute(message, args) {
		const guildId = message.guildId;
		const defendant = message.mentions.users.first();
		if (!defendant)
			return message.reply("you must mention a user to take to court");
		const defendantId = defendant.id;
		const prosecutorId = message.author.id;
		const channelId = message.channelId;
		const re = new RegExp(`^<@!?${defendantId}>$`);
		const durationIdx = args.findIndex((w) => !!parseTime(w));
		if (durationIdx === -1) {
			return message.reply(
				"you must provide a voting period (e.g. `10m`, `1h`, `3d`)",
			);
		}
		const ms = parseTime(args[durationIdx]);
		if (ms === null || !isFinite(ms)) {
			return message.reply("invalid time format");
		}
		const voteDeadline = new Date(Date.now() + ms);
		args.splice(durationIdx, 1);

		const MIN_DURATION = parseTime("10m");
		const MAX_DURATION = parseTime("30d");
		if (voteDeadline.getTime() - Date.now() < MIN_DURATION) {
			return message.reply("minimum voting period is 10 minutes");
		}
		if (voteDeadline.getTime() - Date.now() > MAX_DURATION) {
			return message.reply("max voting period is 30 day");
		}

		const reason = args.filter((word) => !re.test(word)).join(" ");
		if (!reason)
			return message.reply("you must give a reason for this case");

		// ─── Write to DB ──────────────────────────────────────────
		const db = require("../../../db");
		const courtCase = await db.prisma.courtCase.create({
			data: {
				guildId,
				defendantId,
				prosecutorId,
				channelId,
				reason,
				status: "VOTING",
				voteDeadline,
			},
		});

		// ─── v2 Container ─────────────────────────────────────────
		const caseNumber = courtCase.id.slice(0, 8).toUpperCase();
		const relativeTime = `<t:${Math.floor(voteDeadline.getTime() / 1000)}:R>`;

		const container = new ContainerBuilder()
			.setAccentColor(0x2b2d31)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`# ⚖️ Case #${caseNumber}`),
			)
			.addSeparatorComponents(
				new SeparatorBuilder()
					.setDivider(true)
					.setSpacing(SeparatorSpacingSize.Small),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`**${message.author.username}** has filed a case against **${defendant.username}**`,
				),
			)
			.addSeparatorComponents(
				new SeparatorBuilder()
					.setDivider(true)
					.setSpacing(SeparatorSpacingSize.Small),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					[
						`👤 **Defendant** · ${defendant}`,
						`🛡️ **Prosecutor** · ${message.author}`,
						`📋 **Reason**`,
						`\`\`\`${reason}\`\`\``,
						`⏳ Voting ends ${relativeTime} · 📊 **Status:** \`VOTING\``,
					].join("\n"),
				),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`Case created · ID: ${courtCase.id}`,
				),
			);

		// Voting buttons
		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`court_guilty_${courtCase.id}`)
				.setLabel("Guilty")
				.setStyle(ButtonStyle.Danger)
				.setEmoji("🔴"),
			new ButtonBuilder()
				.setCustomId(`court_notguilty_${courtCase.id}`)
				.setLabel("Not Guilty")
				.setStyle(ButtonStyle.Success)
				.setEmoji("🟢"),
		);

		const caseMessage = await message.channel.send({
			components: [container, row],
			flags: MessageFlags.IsComponentsV2,
		});

		// Save the message ID so we can edit it later
		await db.prisma.courtCase.update({
			where: { id: courtCase.id },
			data: { messageId: caseMessage.id },
		});

		courtCaseResolver.recheck(message.client);
	},
};
