const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
const FILTER_TYPES = ["keyword", "caps", "emoji", "images", "invites", "links", "malicious", "massmention", "nsfw", "repetition", "spam", "walloftext"];

module.exports = {

commandId: "0f038a8e-fd64-417a-8164-a8b915efdc61",
	name: "filter",
	parent: "automod",
	description: "Enable/configure an automod filter",
	usage: "automod filter <type> <on|off> [threshold] [punishment]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const type = (args[0] || "").toLowerCase();

		if (!type || !FILTER_TYPES.includes(type)) {
			return message.reply(buildMessage("Filter types: " + FILTER_TYPES.join(", "), 0xe05252));
		}

		const cfg = await automation.ensureAutomodConfig(prisma, guild.id);
		const value = (args[1] || "").toLowerCase();
		const on = ["on", "true", "yes"].includes(value);
		const threshold = args[2] ? parseInt(args[2], 10) : null;
		const punishment = args[3] || null;

		await prisma.automodFilter.upsert({
			where: { configId_type: { configId: guild.id, type } },
			create: { configId: guild.id, type, enabled: on, threshold, punishment },
			update: { enabled: on, threshold, punishment },
		});

		return message.reply(buildMessage("**" + type + "** filter " + (on ? "enabled" : "disabled") + ".", on ? 0x57f287 : 0xe05252));
	},
};