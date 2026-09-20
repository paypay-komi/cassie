const { PermissionsBitField } = require("discord.js");
module.exports = {
	commandId: "5db3ec85-f624-417a-b5c0-027891b0685e",
	name: "option",
	parent: "tickets",
	description: "Add, remove, or list ticket category options",
	usage: "tickets option <add|remove|list> [label] [emoji] [description] [categoryChannelId]",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guild = message.guild;
		const action = (args[0] || "").toLowerCase();

		if (action === "list") {
			const options = await prisma.ticketOption.findMany({ where: { guildId: guild.id } });
			if (!options.length) return message.reply(buildMessage("No ticket options. Add one with `tickets option add <label>`.", 0xe05252));

			const lines = options.map((o) => `${o.emoji ? o.emoji + " " : ""}**${o.label}**${o.description ? ` — ${o.description}` : ""}${o.channelId ? ` → <#${o.channelId}>` : ""}`);
			return message.reply(buildMessage(`## 🎫 Ticket Options\n${lines.join("\n")}`, 0x5865f2));
		}

		if (action === "remove") {
			const label = args.slice(1).join(" ");
			if (!label) return message.reply(buildMessage("Provide the label to remove.", 0xe05252));
			await prisma.ticketOption.deleteMany({ where: { guildId: guild.id, label } });
			return message.reply(buildMessage(`Removed option **${label}**.`, 0x57f287));
		}

		if (action === "add") {
			const label = args[1];
			if (!label) return message.reply(buildMessage("Provide a label: `tickets option add <label> [emoji] [description]`", 0xe05252));
			const emoji = args[2] || null;
			const description = args[3] || null;
			const channelMention = args[4] || null;
			const channelId = channelMention ? channelMention.replace(/[<#>]/g, "") : null;

			await prisma.ticketOption.create({
				data: { guildId: guild.id, label, emoji, description, channelId },
			});
			return message.reply(buildMessage(`Option **${label}** added.`, 0x57f287));
		}

		return message.reply(buildMessage("Usage: `tickets option <add|remove|list>`", 0xe05252));
	},
};