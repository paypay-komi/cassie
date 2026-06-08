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

	// Channel disabled commands
	async getChannelDisabled(guildId, channelId) {
		return prisma.guildChannelDisabledCommand.findMany({
			where: { guildId, channelId },
		});
	},

	async setChannelDisabled(guildId, channelId, commandId, disabled) {
		if (disabled) {
			return prisma.guildChannelDisabledCommand.upsert({
				where: { channelId_commandId: { channelId, commandId } },
				update: {},
				create: { guildId, channelId, commandId },
			});
		}
		return prisma.guildChannelDisabledCommand
			.deleteMany({ where: { guildId, channelId, commandId } })
			.then(() => null);
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
		const [g, ch, u, guildDisabled, channelDisabled, roleAccess, userAccess] =
			await Promise.all([
				guild.get(guildId),
				channel.get(guildId, channelId),
				user.get(guildId, userId),
				prisma.guildDisabledCommand.findMany({ where: { guildId } }),
				prisma.guildChannelDisabledCommand.findMany({
					where: { guildId, channelId },
				}),
				roleIds.length > 0
					? prisma.guildRoleCommandAccess.findMany({
							where: { guildId, roleId: { in: roleIds } },
						})
					: [],
				prisma.guildUserCommandAccess.findMany({ where: { guildId, userId } }),
			]);

		// Start with guild-level + channel-level disabled
		const disabledSet = new Set([
			...guildDisabled.map((r) => r.commandId),
			...channelDisabled.map((r) => r.commandId),
		]);

		// Apply role-level deny (add to disabled set)
		for (const r of roleAccess) {
			if (!r.allowed) disabledSet.add(r.commandId);
		}

		// Apply user-level deny (add to disabled set)
		for (const r of userAccess) {
			if (!r.allowed) disabledSet.add(r.commandId);
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
};

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
};

module.exports = db;
