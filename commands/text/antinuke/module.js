const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
const MODULE_TYPES = ["ban", "channel", "role", "emoji", "webhook", "botadd", "kick", "invite"];

module.exports = {

commandId: "5dd3fc83-6192-4b4d-8ad1-8325d0c6f5a9",
	name: "module",
	parent: "antinuke",
	description: "Enable/configure an antinuke module",
	usage: "antinuke module <type> <on|off> [punishment] [threshold] [window]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const type = (args[0] || "").toLowerCase();

		if (!type || !MODULE_TYPES.includes(type)) {
			return message.reply(buildMessage("Module types: " + MODULE_TYPES.join(", "), 0xe05252));
		}

		const cfg = await automation.ensureAntinukeConfig(prisma, guild.id);
		const value = (args[1] || "").toLowerCase();
		const on = ["on", "true", "yes"].includes(value);
		const punishment = args[2] || "ban";
		const threshold = args[3] ? parseInt(args[3], 10) : null;
		const window = args[4] ? parseInt(args[4], 10) : null;

		await prisma.antinukeModule.upsert({
			where: { configId_type: { configId: guild.id, type } },
			create: { configId: guild.id, type, enabled: on, punishment, threshold, window },
			update: { enabled: on, punishment, threshold, window },
		});

		return message.reply(buildMessage("**" + type + "** module " + (on ? "enabled" : "disabled") + " (punishment: " + punishment + ").", on ? 0x57f287 : 0xe05252));
	},
};