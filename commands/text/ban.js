const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const fs = require("fs");
const path = require("path");

const BANS_PATH = path.join(__dirname, "../../data/botBans.json");

function loadBans() {
	try { return JSON.parse(fs.readFileSync(BANS_PATH, "utf8")); } catch { return { banned: {} }; }
}
function saveBans(data) {
	fs.writeFileSync(BANS_PATH, JSON.stringify(data, null, 2), "utf8");
}

module.exports = {
	commandId: "b5e0c9a1-2d4e-4a8b-9c0d-1a2b3c4d5e6f",
	name: "ban",
	description: "Ban a user from using the bot (owner only)",
	permissions: ["botOwner"],
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	async execute(message, args) {
		const client = message.client;
		if (!client.owners?.includes(message.author.id)) {
			return message.reply("This command can only be used by bot owners.");
		}
		const mention = message.mentions.users.first();
		let targetId = mention?.id || args[0]?.replace(/[<@!>]/g, "");
		let targetTag = mention ? `${mention.username} (${mention.id})` : args[0] || "unknown";
		if (mention) targetTag = `${mention.username} (${mention.id})`;

		if (!targetId || !/^\d{17,20}$/.test(targetId)) {
			return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Couldn't parse user \`${targetTag}\`\nMention a user or provide their ID.`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2 });
		}
		if (client.owners?.includes(targetId)) {
			return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Cannot ban a bot owner`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2 });
		}
		const bans = loadBans();
		if (bans.banned[targetId]) {
			return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Already banned\n<@${targetId}> is already banned.\n**Reason:** ${bans.banned[targetId].reason || "No reason"}`)).setAccentColor(0xfee75c)], flags: MessageFlags.IsComponentsV2 });
		}
		const reason = args.slice(mention ? 1 : 1).join(" ").trim().slice(0, 500) || "No reason provided";
		bans.banned[targetId] = { reason, bannedBy: message.author.id, at: new Date().toISOString(), tag: targetTag };
		saveBans(bans);

		const container = new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔨 User banned from the bot\n<@${targetId}> has been banned.`))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**User:** ${targetTag} (<@${targetId}>)\n**Reason:** ${reason}\n**By:** <@${message.author.id}>`))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Use \`c.unban <@${targetId}>\` to undo.`));
		container.setAccentColor(0xed4245);
		return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	},
};
