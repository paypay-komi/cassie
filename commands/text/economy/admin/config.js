const { ContainerBuilder, TextDisplayBuilder, MessageFlags, PermissionsBitField } = require("discord.js");

function v2(text) {
	return { components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text))], flags: MessageFlags.IsComponentsV2 };
}

const KEYS = ["currencyName", "currencyNamePlural", "currencySymbol", "dailyBase", "dailyStreakBonus", "dailyCap", "streakResetDays", "workMin", "workMax", "workCooldown", "workStreakBonus", "workStreakDecayInterval", "taxRate", "economyChannel"];

module.exports = {

commandId: "688e68d4-e7f0-414c-b8e5-35064ac0acc0",
	name: "config",
	parent: "economy",
	description: "View or edit economy settings.",
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const econ = message.client.db.economy;

		if (!args.length) {
			const config = await econ.getConfig(message.guildId);
			const lines = KEYS.map(k => {
				const val = config[k] ?? "(not set)";
				return `**${k}** = ${val}`;
			});
			return message.reply(v2(`**Economy Config**\n${lines.join("\n")}`));
		}

		const key = args[0];
		if (!KEYS.includes(key)) return message.reply(v2(`Unknown key \`${key}\`. Available: ${KEYS.join(", ")}`));

		const val = args.slice(1).join(" ");
		if (!val) return message.reply(v2(`Usage: \`c.economy config ${key} <value>\``));

		const parsed = {};
		if (["dailyBase", "dailyStreakBonus", "dailyCap", "streakResetDays", "workMin", "workMax", "workCooldown", "workStreakBonus", "workStreakDecayInterval", "taxRate"].includes(key)) {
			const num = parseInt(val, 10);
			if (isNaN(num)) return message.reply(v2("Value must be a number."));
			if (key === "taxRate" && (num < 0 || num > 100)) return message.reply(v2("Tax rate must be 0–100."));
			parsed[key] = num;
		} else {
			parsed[key] = val;
		}

		await econ.updateConfig(message.guildId, parsed);
		message.reply(v2(`✅ **${key}** set to \`${parsed[key]}\``));
	},
};
