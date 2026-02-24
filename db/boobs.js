// db/index.js
const prisma = require('../prisma/client');

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

	async getRoleDisabledCommands(guildId) {
		const settings = await this.get(guildId);
		return settings.roleDisabledCommands || {};
	},

	async updateRoleDisabledCommands(guildId, roleDisabledCommands) {
		return this.update(guildId, { roleDisabledCommands });
	},

	async getUserDisabledCommandsMap(guildId) {
		const settings = await this.get(guildId);
		return settings.userDisabledCommands || {};
	},

	async updateUserDisabledCommandsMap(guildId, userDisabledCommands) {
		return this.update(guildId, { userDisabledCommands });
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
		const gid = guildId ?? 'dm';

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
			where: { id: 'global' },
			update: {},
			create: { id: 'global' },
		});

		await prisma.globalCommandStats.upsert({
			where: {
				globalStatsId_commandName: {
					globalStatsId: 'global',
					commandName,
				},
			},
			update: {
				count: { increment: 1 },
				lastUsed: now(),
			},
			create: {
				globalStatsId: 'global',
				commandName,
				count: 1,
				lastUsed: now(),
			},
		});
	},

	async getGlobal() {
		return prisma.globalStats.findUnique({
			where: { id: 'global' },
			include: { commands: true },
		});
	},
};

// ------------------------------------------------------
// NAMESPACE: global (JSON objects)
// ------------------------------------------------------
const global = {
	async getGuildSettingsObject() {
		const row = await prisma.guildSettingsObject.findUnique({
			where: { id: 'guild_settings' },
		});
		return row?.data || {};
	},

	async updateGuildSettingsObject(data) {
		return prisma.guildSettingsObject.upsert({
			where: { id: 'guild_settings' },
			update: { data },
			create: { id: 'guild_settings', data },
		});
	},

	async getUserDataObject() {
		const row = await prisma.userDataObject.findUnique({
			where: { id: 'user_data' },
		});
		return row?.data || {};
	},

	async updateUserDataObject(data) {
		return prisma.userDataObject.upsert({
			where: { id: 'user_data' },
			update: { data },
			create: { id: 'user_data', data },
		});
	},
};

// ------------------------------------------------------
// NAMESPACE: settings (merged effective settings)
// ------------------------------------------------------
const settings = {
	async getEffective(guildId, channelId, userId, roleIds = []) {
		const [g, ch, u] = await Promise.all([
			guild.get(guildId),
			channel.get(guildId, channelId),
			user.get(guildId, userId),
		]);

		const guildDisabled = Array.isArray(g.disabledCommands)
			? g.disabledCommands
			: [];

		const channelDisabled = Array.isArray(ch.disabledCommands)
			? ch.disabledCommands
			: [];

		const userRowDisabled = Array.isArray(u.disabledCommands)
			? u.disabledCommands
			: [];

		const roleDisabledMap = g.roleDisabledCommands || {};
		const userDisabledMap = g.userDisabledCommands || {};

		const roleDisabled = new Set();
		for (const roleId of roleIds) {
			const arr = roleDisabledMap[roleId];
			if (Array.isArray(arr)) {
				for (const cmd of arr) roleDisabled.add(cmd);
			}
		}

		const userMapDisabled = Array.isArray(userDisabledMap[userId])
			? userDisabledMap[userId]
			: [];

		const disabledSet = new Set([
			...guildDisabled,
			...channelDisabled,
			...roleDisabled,
			...userRowDisabled,
			...userMapDisabled,
		]);

		const prefix = u.customPrefix || g.prefix || 'c.';

		return {
			guildId,
			channelId,
			userId,
			prefix,
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
	settings,
};

module.exports = db;
