const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const db = require("../../../db");
const trackedMessages = require("../../../lib/reactionRoleCache");

module.exports = {
	commandId: "a2b3c4d5-e6f7-8901-abcd-ef2345678901",
	name: "create",
	description: "Create a reaction role message",
	parent: "reactionrole",
	dmUse: false,
	guildUse: true,
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.AddReactions,
		PermissionsBitField.Flags.ManageMessages,
		PermissionsBitField.Flags.ManageRoles,
	],
	async execute(message, args) {
		const guild = message.guild;
		if (!guild) return message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ❌ Server only`)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });

		// Check permissions
		if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
			return message.reply({ content: "You need the **Manage Roles** permission to create reaction roles.", allowedMentions: { parse: [] } });
		}

		// Parse: #channel emoji @role [emoji @role ...]
		// args[0] should be a channel mention or ID
		if (args.length < 3) {
			return message.reply({
				components: [new ContainerBuilder()
					.addTextDisplayComponents(new TextDisplayBuilder().setContent(
						`## Usage\n\`c.reactionrole create #channel 😀 @Role 🎉 @Role\`\n\nPairs of emoji + role. The bot will send a message with those reactions.`
					))
					.setAccentColor(0xfee75c)],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		// Extract channel
		const channelMention = args[0].match(/^<#(\d+)>$/);
		const channelId = channelMention ? channelMention[1] : ( /^\d{17,20}$/.test(args[0]) ? args[0] : null );
		if (!channelId) {
			return message.reply({ content: "First argument must be a channel mention or ID.", allowedMentions: { parse: [] } });
		}

		const channel = guild.channels.cache.get(channelId);
		if (!channel) return message.reply({ content: "Channel not found.", allowedMentions: { parse: [] } });
		if (!channel.isTextBased()) return message.reply({ content: "That's not a text channel.", allowedMentions: { parse: [] } });

		// Check bot can send messages + add reactions in that channel
		const botPerms = channel.permissionsFor(guild.members.me);
		if (!botPerms?.has(PermissionsBitField.Flags.SendMessages)) {
			return message.reply({ content: `I can't send messages in ${channel}.`, allowedMentions: { parse: [] } });
		}
		if (!botPerms?.has(PermissionsBitField.Flags.AddReactions)) {
			return message.reply({ content: `I need **Add Reactions** permission in ${channel}.`, allowedMentions: { parse: [] } });
		}

		// Parse emoji @role pairs from remaining args
		const pairs = [];
		const remaining = args.slice(1);
		let i = 0;

		while (i < remaining.length) {
			// Try to match a role mention or ID
			const roleMatch = remaining[i]?.match(/^<@&(\d+)>$/);
			const roleId = roleMatch ? roleMatch[1] : ( /^\d{17,20}$/.test(remaining[i]) ? remaining[i] : null );

			if (roleId && i > 0) {
				// Previous arg should be an emoji
				const emojiStr = remaining[i - 1];
				const role = guild.roles.cache.get(roleId);
				if (!role) return message.reply({ content: `Role not found: ${remaining[i]}`, allowedMentions: { parse: [] } });
				if (role.position >= guild.members.me.roles.highest.position) {
					return message.reply({ content: `I can't assign ${role} — it's higher than or equal to my highest role.`, allowedMentions: { parse: [] } });
				}
				// Validate emoji
				const customEmojiMatch = emojiStr.match(/^<a?:\w+:(\d+)>$/);
				// Accept any string that contains at least one emoji character (broad check)
				const hasEmoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(emojiStr);
				if (!customEmojiMatch && !hasEmoji) {
					return message.reply({ content: `Invalid emoji: \`${emojiStr}\`. Use a Unicode emoji or custom emoji.`, allowedMentions: { parse: [] } });
				}
				const emojiKey = customEmojiMatch ? `custom:${customEmojiMatch[1]}` : emojiStr;
				pairs.push({ emoji: emojiKey, roleId, emojiDisplay: emojiStr });
				i++;
			} else if (!roleId) {
				// Might be an emoji followed by a role in the next position
				if (i + 1 >= remaining.length) {
					return message.reply({ content: `Expected a role after ${remaining[i]}.`, allowedMentions: { parse: [] } });
				}
				const nextRoleMatch = remaining[i + 1]?.match(/^<@&(\d+)>$/);
				const nextRoleId = nextRoleMatch ? nextRoleMatch[1] : ( /^\d{17,20}$/.test(remaining[i + 1]) ? remaining[i + 1] : null );
				if (!nextRoleId) {
					return message.reply({ content: `Expected a role after \`${remaining[i]}\`, got \`${remaining[i + 1]}\`.`, allowedMentions: { parse: [] } });
				}
				const role = guild.roles.cache.get(nextRoleId);
				if (!role) return message.reply({ content: `Role not found: ${remaining[i + 1]}`, allowedMentions: { parse: [] } });
				if (role.position >= guild.members.me.roles.highest.position) {
					return message.reply({ content: `I can't assign ${role} — it's higher than or equal to my highest role.`, allowedMentions: { parse: [] } });
				}
				const emojiStr = remaining[i];
				const customEmojiMatch = emojiStr.match(/^<a?:\w+:(\d+)>$/);
				const hasEmoji = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(emojiStr);
				if (!customEmojiMatch && !hasEmoji) {
					return message.reply({ content: `Invalid emoji: \`${emojiStr}\`.`, allowedMentions: { parse: [] } });
				}
				const emojiKey = customEmojiMatch ? `custom:${customEmojiMatch[1]}` : emojiStr;
				pairs.push({ emoji: emojiKey, roleId: nextRoleId, emojiDisplay: emojiStr });
				i += 2;
			} else {
				return message.reply({ content: `Unexpected argument: \`${remaining[i]}\`.`, allowedMentions: { parse: [] } });
			}
		}

		if (pairs.length === 0) {
			return message.reply({ content: "No valid emoji + role pairs found.", allowedMentions: { parse: [] } });
		}

		if (pairs.length > 20) {
			return message.reply({ content: "Maximum 20 reaction roles per message.", allowedMentions: { parse: [] } });
		}

		// Build the message content
		const lines = pairs.map((p) => `${p.emojiDisplay} → ${guild.roles.cache.get(p.roleId)?.name || "Unknown Role"}`);
		const content = `## 🎭 Reaction Roles\nReact to get a role!\n\n${lines.join("\n")}`;

		// Send the reaction role message
		let rrMsg;
		try {
			rrMsg = await channel.send({
				components: [new ContainerBuilder()
					.addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
					.setAccentColor(0x5865f2)],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (err) {
			return message.reply({ content: `Failed to send message in ${channel}: ${err.message}`, allowedMentions: { parse: [] } });
		}

		// Add reactions
		for (const pair of pairs) {
			try {
				if (pair.emoji.startsWith("custom:")) {
					const emojiId = pair.emoji.split(":")[1];
					const emoji = guild.emojis.cache.get(emojiId);
					if (emoji) await rrMsg.react(emoji);
				} else {
					await rrMsg.react(pair.emoji);
				}
			} catch (err) {
				// If custom emoji fails, try as unicode
				try { await rrMsg.react(pair.emojiDisplay); } catch {}
			}
		}

		// Store in DB
		const reactionRole = await db.prisma.reactionRole.create({
			data: {
				guildId: guild.id,
				channelId: channelId,
				messageId: rrMsg.id,
				creatorId: message.author.id,
				entries: {
					create: pairs.map((p) => ({
						emoji: p.emoji,
						roleId: p.roleId,
					})),
				},
			},
			include: { entries: true },
		});

		// Update cache
		trackedMessages.set(rrMsg.id, {
			guildId: guild.id,
			channelId: channelId,
			entries: reactionRole.entries.map((e) => ({ emoji: e.emoji, roleId: e.roleId })),
		});

		return message.reply({
			components: [new ContainerBuilder()
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(
					`## ✅ Reaction Role Created\n` +
					`**Channel:** ${channel}\n` +
					`**Message:** [Jump](${rrMsg.url})\n` +
					`**Roles:** ${pairs.length}`
				))
				.addSeparatorComponents((s) => s.setSpacing(SeparatorSpacingSize.Small).setDivider(true))
				.addTextDisplayComponents(new TextDisplayBuilder().setContent(
					pairs.map((p) => `${p.emojiDisplay} → ${guild.roles.cache.get(p.roleId)}`).join("\n")
				))
				.setAccentColor(0x57f287)],
			flags: MessageFlags.IsComponentsV2,
			allowedMentions: { parse: [] },
		});
	},
};
