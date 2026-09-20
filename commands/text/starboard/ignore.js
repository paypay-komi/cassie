const { PermissionsBitField } = require("discord.js");
const { buildMessage } = require("../../../lib/v2Reply");
const starboard = require("../../../lib/starboard");

module.exports = {

commandId: "67957d74-fde4-4e9e-839b-b05e42b42cb6",
	name: "ignore",
	parent: "starboard",
	description: "Ignore channels/roles/members for a starboard (admin)",
	dmUse: false,
	requiredUserPermissions: [PermissionsBitField.Flags.ManageGuild],

	async execute(message, args) {
		const prisma = message.client.db.prisma;
		const guildId = message.guild.id;

		const emoji = starboard.parseEmojiInput(args[0]);
		const action = (args[1] || "").toLowerCase();

		const channel = message.mentions.channels.first();
		const role = message.mentions.roles.first();
		const user = message.mentions.users.first();
		const target = channel
			? { id: channel.id, type: "channel" }
			: role
				? { id: role.id, type: "role" }
				: user
					? { id: user.id, type: "member" }
					: null;

		if (!emoji || !["add", "remove", "list"].includes(action))
			return message.reply(
				buildMessage(
					"Usage: `c.starboard ignore <emoji> add|remove|list [#channel|@role|@user]`",
				),
			);

		const board = await prisma.starboard.findUnique({
			where: { guildId_emoji: { guildId, emoji } },
			include: { ignored: true },
		});
		if (!board) return message.reply(buildMessage("No starboard uses that emoji."));

		if (action === "list") {
			if (!board.ignored.length)
				return message.reply(buildMessage("Nothing is ignored for this starboard."));
			const lines = board.ignored.map((ig) => {
				if (ig.targetType === "channel") return `🚫 <#${ig.targetId}>`;
				if (ig.targetType === "role") return `🚫 <@&${ig.targetId}>`;
				return `🚫 <@${ig.targetId}>`;
			});
			return message.reply(
				buildMessage([`## Ignored for ${emoji}`, ...lines].join("\n")),
			);
		}

		if (!target)
			return message.reply(buildMessage("Mention a channel, role, or user."));

		const label =
			target.type === "channel"
				? `<#${target.id}>`
				: target.type === "role"
					? `<@&${target.id}>`
					: `<@${target.id}>`;

		if (action === "add") {
			await prisma.starboardIgnore.upsert({
				where: {
					starboardId_targetId_targetType: {
						starboardId: board.id,
						targetId: target.id,
						targetType: target.type,
					},
				},
				update: {},
				create: {
					starboardId: board.id,
					targetId: target.id,
					targetType: target.type,
				},
			});
			return message.reply(buildMessage(`🚫 Ignoring ${label}.`));
		}

		await prisma.starboardIgnore.deleteMany({
			where: {
				starboardId: board.id,
				targetId: target.id,
				targetType: target.type,
			},
		});
		return message.reply(buildMessage(`✅ No longer ignoring ${label}.`));
	},
};
