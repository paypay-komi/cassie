const { PermissionsBitField } = require("discord.js");

module.exports = {

commandId: "2ee4f576-a337-492b-a62f-0091a1799890",
	name: "manage",
	description: "Manage command access and restrictions for this server.",
	guildOwnerOnly: true,
	dmUse: false,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
};
