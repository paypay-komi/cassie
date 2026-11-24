const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {

commandId: "70845a8f-32d2-4b8c-b47a-cd6b19cf0ade",
	name: "sticker",
	description: "List this server's stickers, or post one by name.",
	usage: "sticker [name]",
	dmUse: false,
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	category: {
		name: "Utility",
		emoji: "🔧",
		description: "Practical tools and utilities.",
		order: 30,
	},
	aliases: ["stickers"],
	args: ArgsBuilder.create(),

	async execute(message, args) {
		const stickers = await message.guild.stickers.fetch();
		const name = args.join(" ").trim().toLowerCase();

		if (!name) {
			if (!stickers.size) {
				return message.reply(buildMessage("This server has no stickers yet.", 0xe05252));
			}
			const list = [...stickers.values()].map((s) => "• **" + s.name + "**").join("\n");
			return message.reply(buildMessage("**Server stickers**\n" + list + "\n\nPost one with `sticker <name>`.", 0x57f287));
		}

		const match =
			stickers.find((s) => s.name.toLowerCase() === name) ||
			stickers.find((s) => s.name.toLowerCase().includes(name));
		if (!match) {
			return message.reply(buildMessage("No sticker named **" + args.join(" ") + "** here. Run `sticker` to see the list.", 0xe05252));
		}

		return message.channel.send({ stickers: [match] });
	},
};
