const { resolveRequired, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "84ed026c-f9b6-492b-9b65-3f9288d5a26d",
	name: "role",
	parent: "reset",
	description:
		"Remove role-level allow/deny for a command. Usage: `c.manage reset role @role <command>`",
	args: ArgsBuilder.create()
		.role("role", { required: true, description: "The role" })
		.string("command", { autocomplete: suggestCommandNames, required: true, description: "The command to reset" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage reset role @role <command>`",
			));
		}

		const raw = args.shift();
		let role, roleId;
		if (raw === "@everyone") {
			role = message.guild.roles.everyone;
			roleId = message.guild.id;
		} else {
			roleId = raw.replace(/[<@&>]/g, "");
			role = message.guild.roles.cache.get(roleId);
		}
		if (!role) return message.reply(pingSafeMesage("❌ Role not found."));

		const input = args.join(" ").toLowerCase();
		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.prisma.guildRoleCommandAccess.deleteMany({
			where: { guildId: message.guildId, roleId, commandId },
		});

		return message.reply(pingSafeMesage(
			`✅ Override removed for **${role.name}** on \`${input}\`. It now uses default permissions.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
