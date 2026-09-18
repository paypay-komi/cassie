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
	commandId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
	name: "unban",
	description: "Unban a user from the bot (owner only)",
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

		if (!targetId || !/^\d{17,20}$/.test(targetId)) {
			return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Couldn't parse user \`${targetTag}\`\nMention a user or provide their ID.`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2 });
		}
		const bans = loadBans();
		if (!bans.banned[targetId]) {
			return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Not banned\n<@${targetId}> isn't banned.`)).setAccentColor(0xfee75c)], flags: MessageFlags.IsComponentsV2 });
		}
		const prev = bans.banned[targetId];
		delete bans.banned[targetId];
		saveBans(bans);

		const container = new ContainerBuilder()
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ✅ Unbanned\n<@${targetId}> can use the bot again.`))
			.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
			.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**User:** ${targetTag} (<@${targetId}>)\n**Was banned for:** ${prev.reason || "No reason"}`));
		container.setAccentColor(0x57f287);
		return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
	},
};
