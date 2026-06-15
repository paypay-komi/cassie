const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "86781955-2794-4e86-a44c-0dad06620d30",
	name: "role",
	parent: "disable",
	description: "Deny a role from using commands.",
	args: ArgsBuilder.create()
		.role("role", { required: true, description: "The role to restrict" })
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage disable role @role <command>` or `c.manage disable role @role all`",
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

		if (input === "all") {
			const { prisma } = message.client.db;
			const allIds = getAllCommandIds(message.client);
			await prisma.$transaction([
				prisma.guildRoleCommandAccess.deleteMany({
					where: { guildId: message.guildId, roleId },
				}),
				prisma.guildRoleCommandAccess.createMany({
					data: allIds.map((id) => ({
						guildId: message.guildId,
						roleId,
						commandId: id,
						allowed: false,
					})),
				}),
			]);
			return message.reply(pingSafeMesage(
				`🚫 **${role.name}** is now denied from using all commands.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
			));
		}

		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(pingSafeMesage(`❌ ${err.message}`));
		}

		await message.client.db.commandAccess.setRoleAccess(
			message.guildId,
			roleId,
			commandId,
			false,
		);

		return message.reply(pingSafeMesage(
			`🚫 **${role.name}** is now denied from using \`${input}\`.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
