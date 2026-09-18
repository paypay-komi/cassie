// Server exploration tools for the AI chat — read-only, guild-scoped
// Exports TOOLS (definitions) and handleTool (handler) for integration into chat.js
const { ChannelType, PermissionsBitField } = require("discord.js");

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function clampLimit(n) {
	const v = parseInt(n, 10) || DEFAULT_LIMIT;
	return Math.max(1, Math.min(MAX_LIMIT, v));
}

function paginate(arr, page, limit) {
	const start = (page - 1) * limit;
	const slice = arr.slice(start, start + limit);
	return {
		results: slice,
		page,
		limit,
		total: arr.length,
		totalPages: Math.ceil(arr.length / limit),
		hasMore: start + limit < arr.length,
	};
}

function fmtDate(d) {
	if (!d) return null;
	return new Date(d).toISOString();
}

function fmtPerms(perms) {
	if (!perms || typeof perms.toArray !== "function") return [];
	return perms.toArray();
}

// ======================== TOOL DEFINITIONS ========================

const TOOLS = [
	// ── Server ──
	{
		type: "function",
		function: {
			name: "get_server_data",
			description: "Get detailed information about the current server: name, ID, owner, member count, boost info, features, verification level, creation date, icon, rules channel, system channel, etc.",
			parameters: { type: "object", properties: {} },
		},
	},
	// ── Members ──
	{
		type: "function",
		function: {
			name: "get_members",
			description: "List members in the server with pagination. Returns IDs, display names, bot status, and boost status. Use page (default 1) and limit (default 25, max 100).",
			parameters: { type: "object", properties: {
				page: { type: "integer", description: "Page number (default 1)" },
				limit: { type: "integer", description: "Results per page (default 25, max 100)" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_member_names",
			description: "Get all member display names in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_member_ids",
			description: "Get all member IDs in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_members",
			description: "Search members by display name or username (case-insensitive substring match). Returns matching members with IDs and names.",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query (substring match)" },
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_member_data",
			description: "Get detailed information about a specific member: ID, username, display name, nickname, avatar, account age, join date, roles, highest role, permissions, boost status, presence, timeout, flags.",
			parameters: { type: "object", properties: {
				member_id: { type: "string", description: "The member's user ID" },
			}},
			required: ["member_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_member_roles",
			description: "Get the list of roles for a specific member.",
			parameters: { type: "object", properties: {
				member_id: { type: "string", description: "The member's user ID" },
			}},
			required: ["member_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_member_permissions",
			description: "Get the resolved permissions for a specific member in the server (their effective permissions).",
			parameters: { type: "object", properties: {
				member_id: { type: "string", description: "The member's user ID" },
			}},
			required: ["member_id"],
		},
	},
	// ── Roles ──
	{
		type: "function",
		function: {
			name: "get_roles",
			description: "List all roles in the server with pagination. Returns ID, name, color, position, member count, and hoist status.",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_role_names",
			description: "Get all role names in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_role_ids",
			description: "Get all role IDs in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_roles",
			description: "Search roles by name (case-insensitive substring match).",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_role_data",
			description: "Get detailed information about a specific role: ID, name, color, position, permissions, hoisted, mentionable, managed, creation date, member count.",
			parameters: { type: "object", properties: {
				role_id: { type: "string", description: "The role ID" },
			}},
			required: ["role_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_role_members",
			description: "Get members who have a specific role (paginated).",
			parameters: { type: "object", properties: {
				role_id: { type: "string", description: "The role ID" },
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
			required: ["role_id"],
		},
	},
	// ── Channels ──
	{
		type: "function",
		function: {
			name: "get_channels",
			description: "List all channels in the server with pagination. Returns ID, name, type, category, and position.",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_channel_names",
			description: "Get all channel names in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_channel_ids",
			description: "Get all channel IDs in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_channels",
			description: "Search channels by name (case-insensitive substring match).",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_channel_data",
			description: "Get detailed information about a specific channel: ID, name, type, topic, category, position, NSFW, slowmode, bitrate, user limit, thread settings, forum settings, creation date. Adapts output based on channel type.",
			parameters: { type: "object", properties: {
				channel_id: { type: "string", description: "The channel ID" },
			}},
			required: ["channel_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_channel_permissions",
			description: "Get permission overwrites for a specific channel. Shows who has access and what permissions.",
			parameters: { type: "object", properties: {
				channel_id: { type: "string", description: "The channel ID" },
			}},
			required: ["channel_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_channel_members",
			description: "Get members who can see a specific channel, based on permission overwrites (paginated).",
			parameters: { type: "object", properties: {
				channel_id: { type: "string", description: "The channel ID" },
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
			required: ["channel_id"],
		},
	},
	// ── Categories ──
	{
		type: "function",
		function: {
			name: "get_categories",
			description: "List all categories in the server with pagination. Returns ID, name, position, and channel count.",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_category_names",
			description: "Get all category names in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_category_ids",
			description: "Get all category IDs in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_categories",
			description: "Search categories by name (case-insensitive substring match).",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_category_data",
			description: "Get detailed information about a specific category: ID, name, position, creation date, and the channels it contains.",
			parameters: { type: "object", properties: {
				category_id: { type: "string", description: "The category ID" },
			}},
			required: ["category_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_category_channels",
			description: "Get all channels within a specific category (paginated).",
			parameters: { type: "object", properties: {
				category_id: { type: "string", description: "The category ID" },
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
			required: ["category_id"],
		},
	},
	// ── Threads ──
	{
		type: "function",
		function: {
			name: "get_threads",
			description: "List active threads in the server (paginated). Returns ID, name, parent channel, creator, and message count.",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_threads",
			description: "Search threads by name (case-insensitive substring match, active threads only).",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_thread_data",
			description: "Get detailed information about a specific thread: ID, name, parent channel, creator, creation date, message count, archived status, auto-archive duration, applied tags.",
			parameters: { type: "object", properties: {
				thread_id: { type: "string", description: "The thread ID" },
			}},
			required: ["thread_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_thread_members",
			description: "Get members in a specific thread (paginated).",
			parameters: { type: "object", properties: {
				thread_id: { type: "string", description: "The thread ID" },
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
			required: ["thread_id"],
		},
	},
	// ── Messages ──
	{
		type: "function",
		function: {
			name: "get_message",
			description: "Get a specific message by ID from a channel. Returns content, author, timestamp, edits, reactions, attachments, references.",
			parameters: { type: "object", properties: {
				channel_id: { type: "string", description: "The channel ID" },
				message_id: { type: "string", description: "The message ID" },
			}},
			required: ["channel_id", "message_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_recent_messages",
			description: "Get recent messages from a channel (paginated, newest first). Returns content, author, timestamp, and message ID.",
			parameters: { type: "object", properties: {
				channel_id: { type: "string", description: "The channel ID" },
				limit: { type: "integer", description: "Number of messages (default 25, max 100)" },
				before: { type: "string", description: "Message ID to get messages before" },
				after: { type: "string", description: "Message ID to get messages after" },
			}},
			required: ["channel_id"],
		},
	},
	{
		type: "function",
		function: {
			name: "search_messages",
			description: "Search for messages containing a query in a channel (case-insensitive substring). Returns matching messages with author and timestamp.",
			parameters: { type: "object", properties: {
				channel_id: { type: "string", description: "The channel ID" },
				query: { type: "string", description: "Text to search for" },
				limit: { type: "integer", description: "Max results (default 25, max 100)" },
			}},
			required: ["channel_id", "query"],
		},
	},
	// ── Emojis ──
	{
		type: "function",
		function: {
			name: "get_emojis",
			description: "List all custom emojis in the server (paginated). Returns ID, name, and whether animated.",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_emoji_names",
			description: "Get all custom emoji names in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_emoji_ids",
			description: "Get all custom emoji IDs in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_emojis",
			description: "Search custom emojis by name (case-insensitive substring match).",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_emoji_data",
			description: "Get detailed information about a specific custom emoji: ID, name, animated, available, creation date, usage stats, creator.",
			parameters: { type: "object", properties: {
				emoji_id: { type: "string", description: "The emoji ID" },
			}},
			required: ["emoji_id"],
		},
	},
	// ── Stickers ──
	{
		type: "function",
		function: {
			name: "get_stickers",
			description: "List all stickers in the server (paginated). Returns ID, name, and type.",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_sticker_names",
			description: "Get all sticker names in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "get_sticker_ids",
			description: "Get all sticker IDs in the server (paginated).",
			parameters: { type: "object", properties: {
				page: { type: "integer" },
				limit: { type: "integer" },
			}},
		},
	},
	{
		type: "function",
		function: {
			name: "search_stickers",
			description: "Search stickers by name (case-insensitive substring match).",
			parameters: { type: "object", properties: {
				query: { type: "string", description: "Search query" },
			}},
			required: ["query"],
		},
	},
	{
		type: "function",
		function: {
			name: "get_sticker_data",
			description: "Get detailed information about a specific sticker: ID, name, description, tags, type, format, availability.",
			parameters: { type: "object", properties: {
				sticker_id: { type: "string", description: "The sticker ID" },
			}},
			required: ["sticker_id"],
		},
	},
];

// ======================== HANDLER ========================

async function handleTool(name, args, message) {
	const guild = message.guild;
	if (!guild) return "This tool only works in servers.";

	switch (name) {
		// ── Server ──
		case "get_server_data": {
			const owner = await guild.fetchOwner().catch(() => null);
			return JSON.stringify({
				id: guild.id,
				name: guild.name,
				description: guild.description || null,
				ownerId: guild.ownerId,
				ownerTag: owner?.user?.tag || null,
				memberCount: guild.memberCount,
				approximateMemberCount: guild.approximateMemberCount || null,
				premiumTier: guild.premiumTier,
				premiumSubscriptionCount: guild.premiumSubscriptionCount || 0,
				verificationLevel: guild.verificationLevel,
				explicitContentFilter: guild.explicitContentFilter,
				defaultMessageNotifications: guild.defaultMessageNotifications,
				features: guild.features,
				icon: guild.iconURL({ size: 256 }) || null,
				splash: guild.splashURL() || null,
				banner: guild.bannerURL() || null,
				createdAt: fmtDate(guild.createdAt),
				rulesChannelId: guild.rulesChannelId || null,
				publicUpdatesChannelId: guild.publicUpdatesChannelId || null,
				systemChannelId: guild.systemChannelId || null,
				vanityURLCode: guild.vanityURLCode || null,
				maxMembers: guild.maximumMembers || null,
				maxPresences: guild.maximumPresences || null,
				channels: guild.channels.cache.size,
				roles: guild.roles.cache.size,
				emojis: guild.emojis.cache.size,
				stickers: guild.stickers.cache.size,
			});
		}

		// ── Members ──
		case "get_members": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const all = guild.members.cache.map((m) => ({
				id: m.id,
				displayName: m.displayName,
				username: m.user.username,
				bot: m.user.bot,
				premiumSince: !!m.premiumSince,
			}));
			all.sort((a, b) => a.displayName.localeCompare(b.displayName));
			return JSON.stringify(paginate(all, page, limit));
		}

		case "get_member_names": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const names = guild.members.cache.map((m) => m.displayName).sort((a, b) => a.localeCompare(b));
			return JSON.stringify(paginate(names, page, limit));
		}

		case "get_member_ids": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const ids = guild.members.cache.map((m) => m.id).sort();
			return JSON.stringify(paginate(ids, page, limit));
		}

		case "search_members": {
			const q = (args.query || "").toLowerCase();
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const matches = guild.members.cache
				.filter((m) => m.displayName.toLowerCase().includes(q) || m.user.username.toLowerCase().includes(q))
				.map((m) => ({ id: m.id, displayName: m.displayName, username: m.user.username, bot: m.user.bot }))
				.sort((a, b) => a.displayName.localeCompare(b.displayName));
			return JSON.stringify(paginate(matches, page, limit));
		}

		case "get_member_data": {
			const member = await guild.members.fetch(args.member_id).catch(() => null);
			if (!member) return "Member not found.";
			const presence = member.presence;
			return JSON.stringify({
				id: member.id,
				username: member.user.username,
				displayName: member.displayName,
				nickname: member.nickname || null,
				tag: member.user.tag,
				avatar: member.user.displayAvatarURL({ size: 256 }) || null,
				bot: member.user.bot,
				system: member.user.system || false,
				createdAt: fmtDate(member.user.createdAt),
				joinedAt: fmtDate(member.joinedAt),
				hoistRole: member.hoistRole?.name || null,
				roles: member.roles.cache.filter((r) => r.id !== guild.id).map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position })).sort((a, b) => b.position - a.position),
				highestRole: { id: member.roles.highest.id, name: member.roles.highest.name, position: member.roles.highest.position },
				color: member.displayHexColor || null,
				permissions: fmtPerms(member.permissions),
				premiumSince: fmtDate(member.premiumSince),
				isPremium: !!member.premiumSince,
				presence: presence ? { status: presence.status, activities: presence.activities.map((a) => ({ name: a.name, type: a.type, details: a.details || null })) } : null,
				muted: member.isCommunicationDisabledUntil() ? fmtDate(member.isCommunicationDisabledUntil()) : false,
				flags: member.user.flags?.toArray() || [],
				voiceChannel: member.voice.channel ? { id: member.voice.channel.id, name: member.voice.channel.name } : null,
			});
		}

		case "get_member_roles": {
			const member = await guild.members.fetch(args.member_id).catch(() => null);
			if (!member) return "Member not found.";
			const roles = member.roles.cache
				.filter((r) => r.id !== guild.id)
				.map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
				.sort((a, b) => b.position - a.position);
			return JSON.stringify(roles);
		}

		case "get_member_permissions": {
			const member = await guild.members.fetch(args.member_id).catch(() => null);
			if (!member) return "Member not found.";
			return JSON.stringify({
				memberId: member.id,
				displayName: member.displayName,
				permissions: fmtPerms(member.permissions),
				all: member.permissions.has(PermissionsBitField.Flags.Administrator),
			});
		}

		// ── Roles ──
		case "get_roles": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const roles = guild.roles.cache
				.filter((r) => r.id !== guild.id)
				.map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position, memberCount: r.members.size, hoist: r.hoist, mentionable: r.mentionable }))
				.sort((a, b) => b.position - a.position);
			return JSON.stringify(paginate(roles, page, limit));
		}

		case "get_role_names": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const names = guild.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.name).sort();
			return JSON.stringify(paginate(names, page, limit));
		}

		case "get_role_ids": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const ids = guild.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
			return JSON.stringify(paginate(ids, page, limit));
		}

		case "search_roles": {
			const q = (args.query || "").toLowerCase();
			const matches = guild.roles.cache
				.filter((r) => r.id !== guild.id && r.name.toLowerCase().includes(q))
				.map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position, memberCount: r.members.size }))
				.sort((a, b) => b.position - a.position);
			return JSON.stringify(matches);
		}

		case "get_role_data": {
			const role = guild.roles.cache.get(args.role_id);
			if (!role) return "Role not found.";
			return JSON.stringify({
				id: role.id,
				name: role.name,
				color: role.hexColor,
				position: role.position,
				permissions: fmtPerms(role.permissions),
				hoist: role.hoist,
				mentionable: role.mentionable,
				managed: role.managed,
				createdAt: fmtDate(role.createdAt),
				memberCount: role.members.size,
				icon: role.iconURL() || null,
				tags: role.tags ? {
					botId: role.tags.botId || null,
					integrationId: role.tags.integrationId || null,
					premiumSubscriberRole: !!role.tags.premiumSubscriberRole,
				} : null,
			});
		}

		case "get_role_members": {
			const role = guild.roles.cache.get(args.role_id);
			if (!role) return "Role not found.";
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const members = role.members
				.map((m) => ({ id: m.id, displayName: m.displayName, username: m.user.username, bot: m.user.bot }))
				.sort((a, b) => a.displayName.localeCompare(b.displayName));
			return JSON.stringify(paginate(members, page, limit));
		}

		// ── Channels ──
		case "get_channels": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const channels = guild.channels.cache
				.map((c) => ({ id: c.id, name: c.name, type: ChannelType[c.type] || c.type, category: c.parent?.name || null, categoryId: c.parentId || null, position: c.position }))
				.sort((a, b) => a.position - b.position);
			return JSON.stringify(paginate(channels, page, limit));
		}

		case "get_channel_names": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const names = guild.channels.cache.map((c) => c.name).sort();
			return JSON.stringify(paginate(names, page, limit));
		}

		case "get_channel_ids": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const ids = guild.channels.cache.map((c) => c.id).sort();
			return JSON.stringify(paginate(ids, page, limit));
		}

		case "search_channels": {
			const q = (args.query || "").toLowerCase();
			const matches = guild.channels.cache
				.filter((c) => c.name.toLowerCase().includes(q))
				.map((c) => ({ id: c.id, name: c.name, type: ChannelType[c.type] || c.type, category: c.parent?.name || null }))
				.sort((a, b) => a.name.localeCompare(b.name));
			return JSON.stringify(matches);
		}

		case "get_channel_data": {
			const ch = guild.channels.cache.get(args.channel_id);
			if (!ch) return "Channel not found.";
			const data = {
				id: ch.id,
				name: ch.name,
				type: ChannelType[ch.type] || ch.type,
				topic: ch.topic || null,
				category: ch.parent?.name || null,
				parentId: ch.parentId || null,
				position: ch.position,
				createdAt: fmtDate(ch.createdAt),
				nsfw: ch.nsfw || false,
				rateLimitPerUser: ch.rateLimitPerUser || 0,
			};
			if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
				data.bitrate = ch.bitrate;
				data.userLimit = ch.userLimit;
				data.rtcRegion = ch.rtcRegion || null;
			}
			if (ch.type === ChannelType.GuildForum) {
				data.defaultReactionEmoji = ch.defaultReactionEmoji || null;
				data.defaultAutoArchiveDuration = ch.defaultAutoArchiveDuration || null;
				data.defaultSortOrder = ch.defaultSortOrder || null;
				data.defaultLayout = ch.defaultLayout || null;
				data.availableTags = ch.availableTags || [];
			}
			if (ch.isTextBased() && !ch.isVoiceBased()) {
				data.lastMessageId = ch.lastMessageId || null;
			}
			return JSON.stringify(data);
		}

		case "get_channel_permissions": {
			const ch = guild.channels.cache.get(args.channel_id);
			if (!ch) return "Channel not found.";
			const overwrites = ch.permissionOverwrites.cache.map((ow) => {
				const entry = { id: ow.id, type: ow.type === 0 ? "role" : "member", allow: fmtPerms(ow.allow), deny: fmtPerms(ow.deny) };
				if (ow.type === 0) {
					const role = guild.roles.cache.get(ow.id);
					entry.name = role ? role.name : (ow.id === guild.id ? "@everyone" : ow.id);
				} else {
					entry.name = ow.id;
				}
				return entry;
			});
			return JSON.stringify({ channelId: ch.id, channelName: ch.name, overwrites });
		}

		case "get_channel_members": {
			const ch = guild.channels.cache.get(args.channel_id);
			if (!ch) return "Channel not found.";
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const canView = (m) => ch.permissionsFor(m)?.has(PermissionsBitField.Flags.ViewChannel);
			const members = guild.members.cache.filter(canView).map((m) => ({ id: m.id, displayName: m.displayName, username: m.user.username })).sort((a, b) => a.displayName.localeCompare(b.displayName));
			return JSON.stringify(paginate(members, page, limit));
		}

		// ── Categories ──
		case "get_categories": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const cats = guild.channels.cache
				.filter((c) => c.type === ChannelType.GuildCategory)
				.map((c) => ({ id: c.id, name: c.name, position: c.position, channelCount: c.children.size }))
				.sort((a, b) => a.position - b.position);
			return JSON.stringify(paginate(cats, page, limit));
		}

		case "get_category_names": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const names = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).map((c) => c.name).sort();
			return JSON.stringify(paginate(names, page, limit));
		}

		case "get_category_ids": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const ids = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).map((c) => c.id);
			return JSON.stringify(paginate(ids, page, limit));
		}

		case "search_categories": {
			const q = (args.query || "").toLowerCase();
			const matches = guild.channels.cache
				.filter((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(q))
				.map((c) => ({ id: c.id, name: c.name, position: c.position, channelCount: c.children.size }));
			return JSON.stringify(matches);
		}

		case "get_category_data": {
			const cat = guild.channels.cache.get(args.category_id);
			if (!cat || cat.type !== ChannelType.GuildCategory) return "Category not found.";
			const children = cat.children.cache.map((c) => ({ id: c.id, name: c.name, type: ChannelType[c.type] || c.type })).sort((a, b) => a.name.localeCompare(b.name));
			return JSON.stringify({
				id: cat.id,
				name: cat.name,
				position: cat.position,
				createdAt: fmtDate(cat.createdAt),
				channelCount: cat.children.size,
				channels: children,
			});
		}

		case "get_category_channels": {
			const cat = guild.channels.cache.get(args.category_id);
			if (!cat || cat.type !== ChannelType.GuildCategory) return "Category not found.";
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const channels = cat.children.cache.map((c) => ({ id: c.id, name: c.name, type: ChannelType[c.type] || c.type, position: c.position })).sort((a, b) => a.position - b.position);
			return JSON.stringify(paginate(channels, page, limit));
		}

		// ── Threads ──
		case "get_threads": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const threads = guild.channels.cache
				.filter((c) => c.isThread())
				.map((t) => ({ id: t.id, name: t.name, parentId: t.parentId, parentName: t.parent?.name || null, creatorId: t.ownerId || null, messageCount: t.messageCount || 0, archived: t.archived, autoArchiveDuration: t.autoArchiveDuration }))
				.sort((a, b) => b.id.localeCompare(a.id));
			return JSON.stringify(paginate(threads, page, limit));
		}

		case "search_threads": {
			const q = (args.query || "").toLowerCase();
			const matches = guild.channels.cache
				.filter((c) => c.isThread() && c.name.toLowerCase().includes(q))
				.map((t) => ({ id: t.id, name: t.name, parentName: t.parent?.name || null, messageCount: t.messageCount || 0 }));
			return JSON.stringify(matches);
		}

		case "get_thread_data": {
			const thread = guild.channels.cache.get(args.thread_id);
			if (!thread || !thread.isThread()) return "Thread not found.";
			return JSON.stringify({
				id: thread.id,
				name: thread.name,
				parentId: thread.parentId,
				parentName: thread.parent?.name || null,
				creatorId: thread.ownerId || null,
				createdAt: fmtDate(thread.createdAt),
				messageCount: thread.messageCount || 0,
				memberCount: thread.memberCount || 0,
				archived: thread.archived,
				locked: thread.locked,
				autoArchiveDuration: thread.autoArchiveDuration,
				appliedTags: thread.appliedTags || [],
				type: ChannelType[thread.type] || thread.type,
			});
		}

		case "get_thread_members": {
			const thread = guild.channels.cache.get(args.thread_id);
			if (!thread || !thread.isThread()) return "Thread not found.";
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			let members = [];
			try {
				const fetched = await thread.members.fetch();
				members = fetched.map((m) => ({ id: m.id, displayName: guild.members.cache.get(m.id)?.displayName || m.id, joinedAt: fmtDate(m.joinedTimestamp) }));
			} catch { members = []; }
			return JSON.stringify(paginate(members, page, limit));
		}

		// ── Messages ──
		case "get_message": {
			const ch = guild.channels.cache.get(args.channel_id);
			if (!ch || !ch.isTextBased()) return "Channel not found or not a text channel.";
			try {
				const msg = await ch.messages.fetch(args.message_id);
				return JSON.stringify({
					id: msg.id,
					content: msg.content,
					author: { id: msg.author.id, username: msg.author.username, displayName: msg.author.displayName, bot: msg.author.bot },
					channelId: msg.channel.id,
					channelName: msg.channel.name,
					timestamp: fmtDate(msg.createdTimestamp),
					editedTimestamp: fmtDate(msg.editedTimestamp),
					reference: msg.reference ? { channelId: msg.reference.channelId, messageId: msg.reference.messageId } : null,
					attachments: msg.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url, size: a.size, contentType: a.contentType })),
					embeds: msg.embeds.length,
					reactions: msg.reactions.cache.map((r) => ({ emoji: r.emoji.name || r.emoji.id, count: r.count })),
					pinned: msg.pinned,
					type: msg.type,
				});
			} catch { return "Message not found or inaccessible."; }
		}

		case "get_recent_messages": {
			const ch = guild.channels.cache.get(args.channel_id);
			if (!ch || !ch.isTextBased()) return "Channel not found or not a text channel.";
			const limit = clampLimit(args.limit);
			const options = { limit };
			if (args.before) options.before = args.before;
			if (args.after) options.after = args.after;
			try {
				const msgs = await ch.messages.fetch(options);
				const arr = msgs.map((m) => ({
					id: m.id,
					content: m.content.slice(0, 500),
					author: { id: m.author.id, username: m.author.username, displayName: m.author.displayName },
					timestamp: fmtDate(m.createdTimestamp),
					reference: m.reference?.messageId || null,
					attachments: m.attachments.size,
					reactions: m.reactions.cache.size,
				}));
				return JSON.stringify({ messages: arr, count: arr.length, channelName: ch.name });
			} catch { return "Failed to fetch messages."; }
		}

		case "search_messages": {
			const ch = guild.channels.cache.get(args.channel_id);
			if (!ch || !ch.isTextBased()) return "Channel not found or not a text channel.";
			const q = (args.query || "").toLowerCase();
			const limit = Math.min(clampLimit(args.limit), 50);
			try {
				let found = [];
				let lastId = null;
				// Scan recent messages (up to ~500) for matches
				for (let i = 0; i < 5 && found.length < limit; i++) {
					const opts = { limit: 100 };
					if (lastId) opts.before = lastId;
					const batch = await ch.messages.fetch(opts);
					if (batch.size === 0) break;
					for (const [, m] of batch) {
						if (m.content.toLowerCase().includes(q)) {
							found.push({ id: m.id, content: m.content.slice(0, 300), author: { id: m.author.id, displayName: m.author.displayName }, timestamp: fmtDate(m.createdTimestamp) });
							if (found.length >= limit) break;
						}
					}
					lastId = batch.last()?.id;
				}
				return JSON.stringify({ matches: found, count: found.length, query: args.query, channelName: ch.name });
			} catch { return "Failed to search messages."; }
		}

		// ── Emojis ──
		case "get_emojis": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const emojis = guild.emojis.cache.map((e) => ({ id: e.id, name: e.name, animated: e.animated, available: e.available })).sort((a, b) => a.name.localeCompare(b.name));
			return JSON.stringify(paginate(emojis, page, limit));
		}

		case "get_emoji_names": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const names = guild.emojis.cache.map((e) => e.name).sort();
			return JSON.stringify(paginate(names, page, limit));
		}

		case "get_emoji_ids": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const ids = guild.emojis.cache.map((e) => e.id);
			return JSON.stringify(paginate(ids, page, limit));
		}

		case "search_emojis": {
			const q = (args.query || "").toLowerCase();
			const matches = guild.emojis.cache
				.filter((e) => e.name.toLowerCase().includes(q))
				.map((e) => ({ id: e.id, name: e.name, animated: e.animated, available: e.available, url: e.url }));
			return JSON.stringify(matches);
		}

		case "get_emoji_data": {
			const emoji = guild.emojis.cache.get(args.emoji_id);
			if (!emoji) return "Emoji not found.";
			return JSON.stringify({
				id: emoji.id,
				name: emoji.name,
				animated: emoji.animated,
				available: emoji.available,
				createdAt: fmtDate(emoji.createdAt),
				url: emoji.url,
				creator: emoji.creator ? { id: emoji.creator.id, username: emoji.creator.username } : null,
				roles: emoji.roles?.cache?.map((r) => ({ id: r.id, name: r.name })) || [],
			});
		}

		// ── Stickers ──
		case "get_stickers": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const stickers = guild.stickers.cache.map((s) => ({ id: s.id, name: s.name, type: s.type, format: s.format })).sort((a, b) => a.name.localeCompare(b.name));
			return JSON.stringify(paginate(stickers, page, limit));
		}

		case "get_sticker_names": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const names = guild.stickers.cache.map((s) => s.name).sort();
			return JSON.stringify(paginate(names, page, limit));
		}

		case "get_sticker_ids": {
			const page = Math.max(1, parseInt(args.page, 10) || 1);
			const limit = clampLimit(args.limit);
			const ids = guild.stickers.cache.map((s) => s.id);
			return JSON.stringify(paginate(ids, page, limit));
		}

		case "search_stickers": {
			const q = (args.query || "").toLowerCase();
			const matches = guild.stickers.cache
				.filter((s) => s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q))
				.map((s) => ({ id: s.id, name: s.name, description: s.description || null, type: s.type }));
			return JSON.stringify(matches);
		}

		case "get_sticker_data": {
			const sticker = guild.stickers.cache.get(args.sticker_id);
			if (!sticker) return "Sticker not found.";
			return JSON.stringify({
				id: sticker.id,
				name: sticker.name,
				description: sticker.description || null,
				tags: sticker.tags || null,
				type: sticker.type,
				format: sticker.format,
				available: sticker.available,
				createdAt: fmtDate(sticker.createdAt),
				user: sticker.user ? { id: sticker.user.id, username: sticker.user.username } : null,
			});
		}

		default:
		return null; // not handled by this module
	}
}

module.exports = { TOOLS, handleTool };
