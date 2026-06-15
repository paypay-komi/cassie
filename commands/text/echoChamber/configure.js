const { PermissionsBitField, EmbedBuilder } = require("discord.js");
const db = require("../../../db");
const parseTime = require("../../../utils/parseTime");

function formatTime(ms) {
	if (!ms) return "0s";
	if (ms % 86400000 === 0) return `${ms / 86400000}d`;
	if (ms % 3600000 === 0) return `${ms / 3600000}h`;
	if (ms % 60000 === 0) return `${ms / 60000}m`;
	return `${ms / 1000}s`;
}

const DEFAULTS = {
	echoChance: 85,
	deleteDelayMin: parseTime("10s"),
	deleteDelayMax: parseTime("1m"),
	echoDelayMin: parseTime("0s"),
	echoDelayMax: parseTime("2h"),
};

const SETTINGS = {
	echoChance: { desc: "Chance a message gets echoed (0-100)", default: DEFAULTS.echoChance, fmt: (v) => `${v}%` },
	deleteDelayMin: { desc: "Min time before message is deleted", default: DEFAULTS.deleteDelayMin, fmt: formatTime },
	deleteDelayMax: { desc: "Max time before message is deleted", default: DEFAULTS.deleteDelayMax, fmt: formatTime },
	echoDelayMin: { desc: "Min time before echo after deletion", default: DEFAULTS.echoDelayMin, fmt: formatTime },
	echoDelayMax: { desc: "Max time before echo after deletion", default: DEFAULTS.echoDelayMax, fmt: formatTime },
};

module.exports = {

commandId: "4634a657-8e59-4698-99c6-927793d2e0d9",
	name: "configure",
	description: "View or change echo chamber settings",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
	],
	requiredUserPermissions: [PermissionsBitField.Flags.ManageChannels],

	parent: "echochamber",
	aliases: ["config"],
	/**
	 * @param {import("discord.js").Message<true>} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		const channelMention = args.shift();
		if (!channelMention) {
			const subNames = Object.keys(this.subcommands).join(", ");
			return message.reply(`usage: \`c.echochamber configure #channel\` to view, or \`c.echochamber configure [setting] #channel [value]\` to set. Settings: ${subNames}`);
		}

		const channelId = channelMention.replace(/[<#>]/g, "");
		const echoChannel = await db.prisma.echoChannel.findFirst({
			where: { channelId },
		});
		if (!echoChannel) return message.reply("that channel isn't an echo chamber");

		const embed = new EmbedBuilder()
			.setTitle(`Echo Chamber Config — <#${channelId}>`)
			.setColor(0x9b59b6);

		const desc = Object.entries(SETTINGS).map(([key, info]) => {
			const val = echoChannel[key] ?? info.default;
			return `**${key}** — ${info.desc}\nCurrent: \`${info.fmt(val)}\` (default: \`${info.fmt(info.default)}\`)`;
		}).join("\n\n");

		embed.setDescription(desc);
		message.reply({ embeds: [embed] });
	},
};
