const { resolveRequired, getAllCommandIds } = require("../../../../lib/commandResolver");

module.exports = {

commandId: "86781955-2794-4e86-a44c-0dad06620d30",
	name: "role",
	parent: "disable",
	description:
		"Deny a role from using commands. Usage: `c.manage disable role @role <command>` or `c.manage disable role @role all`",

	async execute(message, args) {
		if (args.length < 2) {
			return message.reply(
				"❌ Usage: `c.manage disable role @role <command>` or `c.manage disable role @role all`",
			);
		}

		const raw = args.shift();
		const roleId = raw.replace(/[<@&>]/g, "");
		const role = message.guild.roles.cache.get(roleId);
		if (!role) return message.reply("❌ Role not found.");

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
			return message.reply(
				`🚫 **${role.name}** is now denied from using all commands.`,
			);
		}

		let commandId;
		try {
			commandId = resolveRequired(message.client, input);
		} catch (err) {
			return message.reply(`❌ ${err.message}`);
		}

		await message.client.db.commandAccess.setRoleAccess(
			message.guildId,
			roleId,
			commandId,
			false,
		);

		return message.reply(
			`🚫 **${role.name}** is now denied from using \`${input}\`.`,
		);
	},
};
