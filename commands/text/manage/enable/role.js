const { resolveRequired, getAllCommandIds, suggestCommandNames } = require("../../../../lib/commandResolver");
const { ArgsBuilder } = require("../../../../lib/argsBuilder");
const { pingSafeMesage } = require("../../../../utils/safeMsg");

module.exports = {

commandId: "4a347d05-f85e-4d57-b954-eaed7c008f30",
	name: "role",
	parent: "enable",
	description: "Allow a role to use commands.",
	args: ArgsBuilder.create()
		.role("role", { required: true, description: "The role to unrestrict" })
		.string("command", { autocomplete: suggestCommandNames, description: "Command name or \"all\"" }),

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(pingSafeMesage(
				"❌ Usage: `c.manage enable role @role <command>` or `c.manage enable role @role all`",
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
						allowed: true,
					})),
				}),
			]);
			return message.reply(pingSafeMesage(
				`✅ **${role.name}** is now allowed to use all commands.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
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
			true,
		);

		return message.reply(pingSafeMesage(
			`✅ **${role.name}** is now allowed to use \`${input}\`.\n📊 Tip: Use the [dashboard](https://nekomi.tailef6033.ts.net/dashboard) for easier management.`,
		));
	},
};
