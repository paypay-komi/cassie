const prisma = require("../prisma/client");

// Small utility
const now = () => new Date();

// ------------------------------------------------------
// NAMESPACE: guild
// ------------------------------------------------------
const guild = {
	async get(guildId) {
		let settings = await prisma.guildSettings.findUnique({
			where: { guildId },
			include: {
				channels: true,
				userSettings: true,
			},
		});

		if (!settings) {
			settings = await prisma.guildSettings.create({
				data: { guildId },
			});
		}

		return settings;
	},

	async update(guildId, data) {
		return prisma.guildSettings.upsert({
			where: { guildId },
			update: data,
			create: { guildId, ...data },
		});
	},

	async getPrefix(guildId) {
		let settings = await prisma.guildSettings.findUnique({
			where: { guildId },
			select: { prefix: true },
		});
		if (!settings) {
			settings = await prisma.guildSettings.create({
				data: { guildId },
				select: { prefix: true },
			});
		}
		return settings.prefix;
	},
};
const ideas = {
	async handleVote(userId, ideaId, value) {
		const existing = await prisma.ideaVote.findUnique({
			where: { ideaId_userId: { ideaId, userId } },
		});

		// toggling off
		if (existing?.value === value) {
			await prisma.$transaction([
				prisma.ideaVote.delete({
					where: { ideaId_userId: { ideaId, userId } },
				}),
				prisma.idea.update({
					where: { id: ideaId },
					data: { vote_score: { increment: -value } },
				}),
			]);
			return "removed";
		}

		const previousValue = existing?.value ?? 0;
		const scoreDelta = value - previousValue;

		await prisma.$transaction([
			prisma.ideaVote.upsert({
				where: { ideaId_userId: { ideaId, userId } },
				update: { value },
				create: { ideaId, userId, value },
			}),
			prisma.idea.update({
				where: { id: ideaId },
				data: { vote_score: { increment: scoreDelta } },
			}),
		]);

		return value === 1 ? "upvoted" : "downvoted";
	},
	/**
	 *
	 * @param {Number} requestedPage
	 * @param {Number} pageSize
	 * @param {string} sort
	 */
	async getIdeasPage(
		requestedPage,
		userId,
		{ pageSize = 10, sort = "desc" },
	) {
		const totalIdeas = await prisma.idea.count({
			where: { status: "approved" },
		});
		const totalPages = Math.ceil(totalIdeas / pageSize);

		let page = requestedPage;
		let wrapped = false;

		if (requestedPage > totalPages) {
			page = 1;
			wrapped = "start";
		} else if (requestedPage < 1) {
			page = totalPages;
			wrapped = "end";
		}

		const ideas = await prisma.idea.findMany({
			skip: (page - 1) * pageSize,
			take: pageSize,
			where: {
				status: "approved",
			},
			include: {
				votes: {
					where: { userId }, // only the current user's vote
				},
			},
			orderBy: { vote_score: "desc" },
		});

		return { ideas, page, totalPages, wrapped };
	},
};
// ------------------------------------------------------
// NAMESPACE: channel
// ------------------------------------------------------
const channel = {
	async get(guildId, channelId) {
		let ch = await prisma.channelSettings.findFirst({
			where: { guildId, channelId },
		});

		if (!ch) {
			ch = await prisma.channelSettings.create({
				data: { guildId, channelId },
			});
		}

		return ch;
	},

	async update(guildId, channelId, data) {
		const existing = await this.get(guildId, channelId);
		return prisma.channelSettings.update({
			where: { id: existing.id },
			data,
		});
	},
};

// ------------------------------------------------------
// NAMESPACE: user (per guild)
// ------------------------------------------------------
const user = {
	async get(guildId, userId) {
		let settings = await prisma.guildUserSettings.findFirst({
			where: { guildId, userId },
		});

		if (!settings) {
			settings = await prisma.guildUserSettings.create({
				data: { guildId, userId },
			});
		}

		return settings;
	},

	async update(guildId, userId, data) {
		return prisma.guildUserSettings.upsert({
			where: { guildId_userId: { guildId, userId } },
			update: data,
			create: { guildId, userId, ...data },
		});
	},
};

// ------------------------------------------------------
// NAMESPACE: stats (per guild user, per user global, global)
// ------------------------------------------------------
const stats = {
	// ------------------------------------------------------
	// 1. Per-user per-guild per-command (DM-safe)
	// ------------------------------------------------------
	async incrementUserCommand(guildId, userId, commandName) {
		const gid = guildId ?? "dm";

		await prisma.userCommandStats.upsert({
			where: {
				userId_guildId_commandName: {
					userId,
					guildId: gid,
					commandName,
				},
			},
			update: {
				count: { increment: 1 },
				lastUsed: now(),
			},
			create: {
				userId,
				guildId: gid,
				commandName,
				count: 1,
				lastUsed: now(),
			},
		});
	},

	// ------------------------------------------------------
	// 2. Per-user global stats
	// ------------------------------------------------------
	async incrementUserGlobalCommand(userId, commandName) {
		await prisma.userGlobalCommandStats.upsert({
			where: {
				userId_commandName: { userId, commandName },
			},
			update: {
				count: { increment: 1 },
				lastUsed: now(),
			},
			create: {
				userId,
				commandName,
				count: 1,
				lastUsed: now(),
			},
		});
	},

	// ------------------------------------------------------
	// 3. Global command stats
	// ------------------------------------------------------
	async incrementGlobalCommand(commandName) {
		await prisma.globalStats.upsert({
			where: { id: "global" },
			update: {},
			create: { id: "global" },
		});

		await prisma.globalCommandStats.upsert({
			where: {
				globalStatsId_commandName: {
					globalStatsId: "global",
					commandName,
				},
			},
			update: {
				count: { increment: 1 },
				lastUsed: now(),
			},
			create: {
				globalStatsId: "global",
				commandName,
				count: 1,
				lastUsed: now(),
			},
		});
	},

	async getGlobal() {
		return prisma.globalStats.findUnique({
			where: { id: "global" },
			include: { commands: true },
		});
	},

	async getTotalExecutions() {
		const result = await prisma.globalCommandStats.aggregate({
			_sum: { count: true },
		});
		return result._sum.count ?? 0;
	},

	async getTotalUsers() {
		const groups = await prisma.userGlobalCommandStats.groupBy({
			by: ["userId"],
		});
		return groups.length;
	},
};

// ------------------------------------------------------
// NAMESPACE: userPrefix (global per-user custom prefix)
// ------------------------------------------------------
const userPrefix = {
	async get(userId) {
		return prisma.userPrefix.findUnique({ where: { userId } });
	},

	async set(userId, prefix) {
		return prisma.userPrefix.upsert({
			where: { userId },
			update: { prefix },
			create: { userId, prefix },
		});
	},

	async reset(userId) {
		return prisma.userPrefix.delete({ where: { userId } }).catch(() => {});
	},
};

// ------------------------------------------------------
// NAMESPACE: chatHistory (AI conversation memory)
// ------------------------------------------------------
const chatHistory = {
	async getRecent(userId, limit = 20) {
		return prisma.chatMessage.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			take: limit,
		});
	},

	async add(userId, role, content, guildId = null, channelId = null) {
		return prisma.chatMessage.create({
			data: { userId, role, content, guildId, channelId },
		});
	},
};

// ------------------------------------------------------
// NAMESPACE: global (JSON objects)
// ------------------------------------------------------
const global = {
	async getGuildSettingsObject() {
		const row = await prisma.guildSettingsObject.findUnique({
			where: { id: "guild_settings" },
		});
		return row?.data || {};
	},

	async updateGuildSettingsObject(data) {
		return prisma.guildSettingsObject.upsert({
			where: { id: "guild_settings" },
			update: { data },
			create: { id: "guild_settings", data },
		});
	},

	async getUserDataObject() {
		const row = await prisma.userDataObject.findUnique({
			where: { id: "user_data" },
		});
		return row?.data || {};
	},

	async updateUserDataObject(data) {
		return prisma.userDataObject.upsert({
			where: { id: "user_data" },
			update: { data },
			create: { id: "user_data", data },
		});
	},
};

// ------------------------------------------------------
// NAMESPACE: commandAccess (replaces old JSON blob columns)
// ------------------------------------------------------
const commandAccess = {
	// Guild-wide disabled commands
	async getGuildDisabled(guildId) {
		return prisma.guildDisabledCommand.findMany({ where: { guildId } });
	},

	async setGuildDisabled(guildId, commandId, disabled) {
		if (disabled) {
			return prisma.guildDisabledCommand.upsert({
				where: { guildId_commandId: { guildId, commandId } },
				update: {},
				create: { guildId, commandId },
			});
		}
		return prisma.guildDisabledCommand
			.deleteMany({ where: { guildId, commandId } })
			.then(() => null);
	},

	// Channel access (allow/deny override)
	async getChannelAccess(guildId, channelId) {
		return prisma.guildChannelCommandAccess.findMany({
			where: { guildId, channelId },
		});
	},

	async setChannelAccess(guildId, channelId, commandId, allowed) {
		return prisma.guildChannelCommandAccess.upsert({
			where: { channelId_commandId: { channelId, commandId } },
			update: { allowed },
			create: { guildId, channelId, commandId, allowed },
		});
	},

	// Role allow/deny
	async getRoleAccess(guildId, roleId) {
		return prisma.guildRoleCommandAccess.findMany({
			where: { guildId, roleId },
		});
	},

	async setRoleAccess(guildId, roleId, commandId, allowed) {
		return prisma.guildRoleCommandAccess.upsert({
			where: { guildId_roleId_commandId: { guildId, roleId, commandId } },
			update: { allowed },
			create: { guildId, roleId, commandId, allowed },
		});
	},

	async removeRoleAccess(guildId, roleId, commandId) {
		return prisma.guildRoleCommandAccess
			.deleteMany({ where: { guildId, roleId, commandId } })
			.then(() => null);
	},

	async clearRoleAccess(guildId, roleId) {
		return prisma.guildRoleCommandAccess
			.deleteMany({ where: { guildId, roleId } })
			.then(() => null);
	},

	// User allow/deny
	async getUserAccess(guildId, userId) {
		return prisma.guildUserCommandAccess.findMany({
			where: { guildId, userId },
		});
	},

	async setUserAccess(guildId, userId, commandId, allowed) {
		return prisma.guildUserCommandAccess.upsert({
			where: { guildId_userId_commandId: { guildId, userId, commandId } },
			update: { allowed },
			create: { guildId, userId, commandId, allowed },
		});
	},

	async removeUserAccess(guildId, userId, commandId) {
		return prisma.guildUserCommandAccess
			.deleteMany({ where: { guildId, userId, commandId } })
			.then(() => null);
	},

	async clearUserAccess(guildId, userId) {
		return prisma.guildUserCommandAccess
			.deleteMany({ where: { guildId, userId } })
			.then(() => null);
	},
};

// ------------------------------------------------------
// NAMESPACE: settings (merged effective settings)
// ------------------------------------------------------
const settings = {
	async getEffective(guildId, channelId, userId, roleIds = []) {
		const [g, ch, u, guildDisabled, channelAccess, roleAccess, userAccess] =
			await Promise.all([
				guild.get(guildId),
				channel.get(guildId, channelId),
				user.get(guildId, userId),
				prisma.guildDisabledCommand.findMany({ where: { guildId } }),
				prisma.guildChannelCommandAccess.findMany({
					where: { guildId, channelId },
				}),
				roleIds.length > 0
					? prisma.guildRoleCommandAccess.findMany({
							where: { guildId, roleId: { in: roleIds } },
						})
					: [],
				prisma.guildUserCommandAccess.findMany({ where: { guildId, userId } }),
			]);

		// Start with guild-level disabled
		const disabledSet = new Set([
			...guildDisabled.map((r) => r.commandId),
		]);

		// Apply channel-level deny (add to disabled set)
		for (const r of channelAccess) {
			if (!r.allowed) disabledSet.add(r.commandId);
		}

		// Apply role-level deny (add to disabled set)
		for (const r of roleAccess) {
			if (!r.allowed) disabledSet.add(r.commandId);
		}

		// Apply user-level deny (add to disabled set)
		for (const r of userAccess) {
			if (!r.allowed) disabledSet.add(r.commandId);
		}

		// Apply channel-level allow (remove from disabled set)
		for (const r of channelAccess) {
			if (r.allowed) disabledSet.delete(r.commandId);
		}

		// Apply role-level allow (remove from disabled set)
		for (const r of roleAccess) {
			if (r.allowed) disabledSet.delete(r.commandId);
		}

		// Apply user-level allow (remove from disabled set) — highest priority
		for (const r of userAccess) {
			if (r.allowed) disabledSet.delete(r.commandId);
		}

	return {
		guildId,
		channelId,
		userId,
		prefix: "c.",
		disabledCommands: Array.from(disabledSet),
		raw: {
			guild: g,
			channel: ch,
			user: u,
		},
	};
},

/**
 * Determine the source of a restriction for a single commandId.
 *
 * Returns one of: "server", "channel", "role", "user", or null if not restricted.
 *
 * Priority (highest to lowest):
 *   user allow  → not restricted
 *   role allow  → not restricted
 *   channel allow → not restricted
 *   user deny   → "user"
 *   role deny   → "role"
 *   channel deny → "channel"
 *   guild       → "server"
 */
async getDisableSource(guildId, channelId, userId, roleIds, commandId) {
	// User allow — overrides everything
	const userAccess = userId
		? await prisma.guildUserCommandAccess.findUnique({
				where: {
					guildId_userId_commandId: { guildId, userId, commandId },
				},
			})
		: null;
	if (userAccess?.allowed) return null;

	// Role allow — overrides denies and channel/guild
	let roleEntries = [];
	if (roleIds.length > 0) {
		roleEntries = await prisma.guildRoleCommandAccess.findMany({
			where: { guildId, roleId: { in: roleIds }, commandId },
		});
	}
	if (roleEntries.some((r) => r.allowed)) return null;

	// Channel allow — overrides guild disable and channel deny
	const channelEntry = await prisma.guildChannelCommandAccess.findUnique({
		where: { channelId_commandId: { channelId, commandId } },
	});
	if (channelEntry?.allowed) return null;

	// User deny
	if (userAccess && !userAccess.allowed) return "user";

	// Role deny
	if (roleEntries.some((r) => !r.allowed)) return "role";

	// Channel deny
	if (channelEntry && !channelEntry.allowed) return "channel";

	// Guild disable
	const guildDisabled = await prisma.guildDisabledCommand.findUnique({
		where: { guildId_commandId: { guildId, commandId } },
	});
	if (guildDisabled) return "server";

	return null;
},

/**
 * Get all channel IDs where a command has an allow override.
 */
async getChannelAllowLocations(guildId, commandId) {
	const rows = await prisma.guildChannelCommandAccess.findMany({
		where: { guildId, commandId, allowed: true },
		select: { channelId: true },
	});
	return rows.map((r) => r.channelId);
},
};

// ------------------------------------------------------
// NAMESPACE: announcements (webhook-powered broadcast system)
// ------------------------------------------------------
const announcements = {
	async get(guildId) {
		let row = await prisma.guildAnnouncement.findUnique({ where: { guildId } });
		if (!row) {
			row = await prisma.guildAnnouncement.create({ data: { guildId } });
		}
		return row;
	},

	async subscribe(guildId, channelId, webhookId, webhookToken) {
		return prisma.guildAnnouncement.upsert({
			where: { guildId },
			update: { channelId, webhookId, webhookToken, optedOut: false },
			create: { guildId, channelId, webhookId, webhookToken, optedOut: false },
		});
	},

	async unsubscribe(guildId) {
		return prisma.guildAnnouncement.upsert({
			where: { guildId },
			update: { channelId: null, webhookId: null, webhookToken: null, optedOut: true },
			create: { guildId, optedOut: true },
		});
	},

	/** All guilds that have chosen a channel */
	async getSubscribed() {
		return prisma.guildAnnouncement.findMany({
			where: { channelId: { not: null } },
		});
	},

	/** Guilds that joined but never subscribed or unsubscribed (excludes opted-out) */
	async getUnset() {
		return prisma.guildAnnouncement.findMany({
			where: { channelId: null, optedOut: false },
		});
	},

	/** Guilds due for a nag: never nagged, or last nagged before cutoff */
	async getNagDue(cutoff) {
		return prisma.guildAnnouncement.findMany({
			where: {
				channelId: null,
				optedOut: false,
				OR: [{ lastNagged: null }, { lastNagged: { lt: cutoff } }],
			},
		});
	},

	/** Guild with the oldest lastNagged (soonest to need nagging next) */
	async getNextNagDue() {
		return prisma.guildAnnouncement.findFirst({
			where: {
				channelId: null,
				optedOut: false,
				lastNagged: { not: null },
			},
			orderBy: { lastNagged: "asc" },
		});
	},

	/** Mark a guild as nagged right now */
	async markNagged(guildId) {
		return prisma.guildAnnouncement.update({
			where: { guildId },
			data: { lastNagged: new Date() },
		});
	},
};

const economy = require("./economy");

// ------------------------------------------------------
// EXPORT NAMESPACED DB
// ------------------------------------------------------
const db = {
	prisma,
	guild,
	channel,
	user,
	stats,
	global,
	ideas,
	settings,
	commandAccess,
	userPrefix,
	chatHistory,
	announcements,
	economy,
};

module.exports = db;
