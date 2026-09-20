const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const automation = require("../../../lib/automation");
const MODULE_TYPES = ["age", "avatar", "massjoin", "massmention", "unverifiedbots", "username"];

module.exports = {

commandId: "ede7eef9-ac87-4ef0-83fc-7244dd2062c7",
	name: "module",
	parent: "antiraid",
	description: "Enable/configure an antiraid module",
	usage: "antiraid module <type> <on|off> [action] [threshold] [window]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const type = (args[0] || "").toLowerCase();

		if (!type || !MODULE_TYPES.includes(type)) {
			return message.reply(buildMessage("Module types: " + MODULE_TYPES.join(", "), 0xe05252));
		}

		const cfg = await automation.ensureAntiraidConfig(prisma, guild.id);
		const value = (args[1] || "").toLowerCase();
		const on = ["on", "true", "yes"].includes(value);
		const action = args[2] || "kick";
		const threshold = args[3] ? parseInt(args[3], 10) : null;
		const window = args[4] ? parseInt(args[4], 10) : null;

		const data = { configId: guild.id, type, enabled: on, action, threshold, window };
		if (type === "age" && args[5]) data.maxAgeDays = parseInt(args[5], 10);

		await prisma.antiraidModule.upsert({
			where: { configId_type: { configId: guild.id, type } },
			create: data,
			update: data,
		});

		return message.reply(buildMessage("**" + type + "** module " + (on ? "enabled" : "disabled") + ".", on ? 0x57f287 : 0xe05252));
	},
};