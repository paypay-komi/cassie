const { PermissionsBitField } = require("discord.js");

module.exports = {
	name: "manage",
	description: "Manage command access and restrictions for this server.",
	guildOwnerOnly: true,
	dmUse: false,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
};
