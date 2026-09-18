const { PermissionsBitField, ContainerBuilder, TextDisplayBuilder, SeparatorSpacingSize, MessageFlags } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const log = getLogger("servercopy");

const DELAY_MS = 350; // delay between API calls to avoid rate limits

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
	commandId: "d5e6f7a8-b9c0-1234-def0-345678901234",
	name: "servercopy",
	description: "Copy roles, channels, and categories from one server to another (owner only)",
	permissions: ["botOwner"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.ManageRoles,
		PermissionsBitField.Flags.ManageChannels,
		PermissionsBitField.Flags.SendMessages,
	],
	async execute(message, args) {
		const log = getLogger("servercopy");

		if (args.length < 2) {
			return message.reply({
				components: [new ContainerBuilder()
					.addTextDisplayComponents(new TextDisplayBuilder().setContent(
						`## Usage\n\`c.servercopy <sourceGuildId> <targetGuildId>\`\n\nCopies roles, categories, and channels from the source server to the target.\nThe bot must be in both servers with Manage Roles + Manage Channels.`
					))
					.setAccentColor(0xfee75c)],
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			});
		}

		const sourceId = args[0];
		const targetId = args[1];

		if (!/^\d{17,20}$/.test(sourceId) || !/^\d{17,20}$/.test(targetId)) {
			return message.reply({ content: "Both arguments must be valid guild IDs.", allowedMentions: { parse: [] } });
		}

		if (sourceId === targetId) {
			return message.reply({ content: "Source and target can't be the same server.", allowedMentions: { parse: [] } });
		}

		// Fetch both guilds
		const sourceGuild = await message.client.guilds.fetch(sourceId).catch(() => null);
		const targetGuild = await message.client.guilds.fetch(targetId).catch(() => null);

		if (!sourceGuild) return message.reply({ content: `Can't access source guild \`${sourceId}\` — make sure the bot is in it.`, allowedMentions: { parse: [] } });
		if (!targetGuild) return message.reply({ content: `Can't access target guild \`${targetId}\` — make sure the bot is in it.`, allowedMentions: { parse: [] } });

		// Check bot permissions in target
		const botMember = await targetGuild.members.fetch(message.client.user.id).catch(() => null);
		if (!botMember) return message.reply({ content: "Couldn't fetch bot member in target guild.", allowedMentions: { parse: [] } });

		const botPerms = botMember.permissions;
		if (!botPerms.has(PermissionsBitField.Flags.ManageRoles)) {
			return message.reply({ content: "I need **Manage Roles** in the target server.", allowedMentions: { parse: [] } });
		}
		if (!botPerms.has(PermissionsBitField.Flags.ManageChannels)) {
			return message.reply({ content: "I need **Manage Channels** in the target server.", allowedMentions: { parse: [] } });
		}

		const botHighestRole = botMember.roles.highest;

		// Progress tracking
		let statusMsg;
		const status = async (text) => {
			log.info(text);
			if (statusMsg) {
				await statusMsg.edit({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔄 Server Copy\n${text}`)).setAccentColor(0xfee75c)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
			} else {
				statusMsg = await message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🔄 Server Copy\n${text}`)).setAccentColor(0xfee75c)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
			}
		};

		try {
			// ========== PHASE 1: ROLES ==========
			await status(`Fetching roles from **${sourceGuild.name}**...`);

			// Fetch source roles (excluding @everyone)
			const sourceRoles = (await sourceGuild.roles.fetch())
				.filter((r) => r.id !== sourceGuild.id)
				.sort((a, b) => a.position - b.position); // ascending = lowest first

			// Fetch existing target roles
			const targetRoles = await targetGuild.roles.fetch();
			const existingTargetRoles = new Map(targetRoles.filter((r) => r.id !== targetGuild.id).map((r) => [r.name, r]));
			const botRoleId = message.client.user.id;

			await status(`Copying ${sourceRoles.size} roles...`);

			const roleMap = new Map(); // sourceRoleId -> targetRoleId

			for (const [sourceRoleId, sourceRole] of sourceRoles) {
				// Reuse existing role by name
				if (existingTargetRoles.has(sourceRole.name)) {
					const existing = existingTargetRoles.get(sourceRole.name);
					roleMap.set(sourceRoleId, existing.id);
					log.debug(`Role "${sourceRole.name}" already exists, mapping to ${existing.id}`);
					continue;
				}

				try {
					const newRole = await targetGuild.roles.create({
						name: sourceRole.name,
						color: sourceRole.hexColor,
						hoist: sourceRole.hoist,
						mentionable: sourceRole.mentionable,
						permissions: sourceRole.permissions,
						reason: `Server copy from ${sourceGuild.name}`,
					});
					roleMap.set(sourceRoleId, newRole.id);
					log.debug(`Created role "${sourceRole.name}" -> ${newRole.id}`);
					await sleep(DELAY_MS);
				} catch (err) {
					log.error(`Failed to create role "${sourceRole.name}":`, err.message);
				}
			}

			// ========== PHASE 2: CHANNELS (categories first, then rest) ==========
			await status(`Fetching channels from **${sourceGuild.name}**...`);

			const sourceChannels = await sourceGuild.channels.fetch();

			// Separate categories and non-categories
			const categories = sourceChannels
				.filter((c) => c.type === 4) // CategoryChannel
				.sort((a, b) => a.position - b.position);

			const nonCategories = sourceChannels
				.filter((c) => c.type !== 4)
				.sort((a, b) => a.position - b.position);

			// Remap permission overwrites
			function remapOverwrites(overwrites) {
				return overwrites.map((ow) => {
					const newTarget = {
						id: ow.id,
						type: ow.type,
						allow: ow.allow,
						deny: ow.deny,
					};

					// Remap role IDs
					if (ow.type === 0) { // Role
						const newRoleId = roleMap.get(ow.id);
						if (newRoleId) {
							newTarget.id = newRoleId;
						} else if (ow.id === sourceGuild.id) {
							newTarget.id = targetGuild.id; // @everyone
						} else {
							return null; // role wasn't copied, skip this overwrite
						}
					}
					// User overwrites (type 1) keep their original IDs

					return newTarget;
				}).filter(Boolean);
			}

			// Create categories
			const categoryMap = new Map(); // sourceCategoryId -> targetCategoryId
			await status(`Creating ${categories.size} categories...`);

			// Existing categories in target
			const existingCategories = targetGuild.channels.cache.filter((c) => c.type === 4);

			for (const [catId, cat] of categories) {
				// Reuse existing category by name
				if (existingCategories.some((ec) => ec.name === cat.name)) {
					const existing = existingCategories.find((ec) => ec.name === cat.name);
					categoryMap.set(catId, existing.id);
					log.debug(`Category "${cat.name}" already exists, mapping to ${existing.id}`);
					continue;
				}

				try {
					const newCat = await targetGuild.channels.create({
						name: cat.name,
						type: 4, // CategoryChannel
						reason: `Server copy from ${sourceGuild.name}`,
					});
					categoryMap.set(catId, newCat.id);
					log.debug(`Created category "${cat.name}" -> ${newCat.id}`);
					await sleep(DELAY_MS);
				} catch (err) {
					log.error(`Failed to create category "${cat.name}":`, err.message);
				}
			}

			// Create non-category channels
			await status(`Creating ${nonCategories.size} channels...`);
			let channelCount = 0;

			for (const [chId, ch] of nonCategories) {
				const targetCategoryId = ch.parentId ? (categoryMap.get(ch.parentId) || undefined) : undefined;
				const overwrites = remapOverwrites([...ch.permissionOverwrites.cache.values()]);

				const options = {
					name: ch.name,
					type: ch.type,
					reason: `Server copy from ${sourceGuild.name}`,
					permissionOverwrites: overwrites,
				};

				if (targetCategoryId) {
					options.parent = targetCategoryId;
				}

				// Type-specific options
				if (ch.type === 0) { // Text channel
					options.topic = ch.topic || undefined;
					options.nsfw = ch.nsfw;
					options.rateLimitPerUser = ch.rateLimitPerUser;
				} else if (ch.type === 2) { // Voice channel
					options.bitrate = ch.bitrate;
					options.userLimit = ch.userLimit;
					options.rtcRegion = ch.rtcRegion;
				} else if (ch.type === 13) { // Stage channel
					options.bitrate = ch.bitrate;
					options.rtcRegion = ch.rtcRegion;
				} else if (ch.type === 15) { // Forum channel
					options.topic = ch.topic || undefined;
					options.nsfw = ch.nsfw;
					options.defaultReactionEmoji = ch.defaultReactionEmoji;
					options.defaultAutoArchiveDuration = ch.defaultAutoArchiveDuration;
					options.defaultSortOrder = ch.defaultSortOrder;
					options.defaultLayout = ch.defaultLayout;
				}

				try {
					await targetGuild.channels.create(options);
					channelCount++;
					log.debug(`Created channel "${ch.name}" (${ch.type})`);
					await sleep(DELAY_MS);
				} catch (err) {
					log.error(`Failed to create channel "${ch.name}":`, err.message);
				}
			}

			// ========== PHASE 3: CLEANUP EXTRAS ==========
			await status(`Cleaning up extra channels and roles...`);

			// Delete channels in target that don't exist in source
			const finalTargetChannels = await targetGuild.channels.fetch();
			let deletedChannels = 0;
			for (const [, ch] of finalTargetChannels) {
				// Skip if it's in the source (by name match since IDs differ)
				const inSource = nonCategories.some((sc) => sc.name === ch.name && sc.type === ch.type)
					|| categories.some((sc) => sc.name === ch.name);
				if (inSource) continue;
				try {
					await ch.delete(`Server copy cleanup from ${sourceGuild.name}`);
					deletedChannels++;
					await sleep(DELAY_MS);
				} catch (err) {
					log.error(`Failed to delete extra channel "${ch.name}":`, err.message);
				}
			}

			// Delete roles in target that don't exist in source
			const finalTargetRoles = await targetGuild.roles.fetch();
			let deletedRoles = 0;
			const sourceRoleNames = new Set(sourceRoles.map((r) => r.name));
			for (const [, role] of finalTargetRoles) {
				if (role.id === targetGuild.id) continue; // @everyone
				if (role.id === botRoleId) continue; // bot's own role
				if (sourceRoleNames.has(role.name)) continue; // exists in source
				try {
					await role.delete(`Server copy cleanup from ${sourceGuild.name}`);
					deletedRoles++;
					await sleep(DELAY_MS);
				} catch (err) {
					log.error(`Failed to delete extra role "${role.name}":`, err.message);
				}
			}

			// ========== DONE ==========
			const summary = [
				`## ✅ Server Copy Complete`,
				`**Source:** ${sourceGuild.name} (${sourceId})`,
				`**Target:** ${targetGuild.name} (${targetId})`,
				``,
				`**Roles:** ${roleMap.size} kept/created · ${deletedRoles} extras removed`,
				`**Categories:** ${categoryMap.size} kept/created`,
				`**Channels:** ${channelCount} created · ${deletedChannels} extras removed`,
			].join("\n");

			await statusMsg.edit({
				components: [new ContainerBuilder()
					.addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))
					.setAccentColor(0x57f287)],
				flags: MessageFlags.IsComponentsV2,
			}).catch(() => {});

			log.info(`Server copy complete: ${sourceGuild.name} -> ${targetGuild.name} (${roleMap.size} roles, ${categoryMap.size} categories, ${channelCount} channels)`);

		} catch (err) {
			log.error("Server copy failed:", err);
			const errMsg = `## ❌ Server Copy Failed\n${err.message}`;
			if (statusMsg) {
				await statusMsg.edit({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(errMsg)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
			} else {
				await message.reply({ components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(errMsg)).setAccentColor(0xed4245)], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } });
			}
		}
	},
};
