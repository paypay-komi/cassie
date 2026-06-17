const { PermissionsBitField } = require("discord.js");
const db = require("../../../db");
const config = require("../../../config.json");

module.exports = {
	name: "submit",
	description:
		"submmits a gif for review owners bypass the pending stage both stages will add tags if that the user provides if it doesnt already have it proving feed back for both paths ",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	parent: "action",
	aliases: ["add"],
	/**
	 * @param {import("discord.js").Message} message
	 * @param {string[]} args
	 */
	async execute(message, args) {
		if (config.owners.includes(message.author.id)) {
			// skip pending approval stage
			i like this
		}
	},
};
