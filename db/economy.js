const prisma = require("../prisma/client");

const MAX_BALANCE = 2_147_483_647;

/**
 * @param {import("discord.js").Snowflake} guildId
 * @returns {Promise<import('../generated/prisma/client').GuildEconomy>}
 */
function getConfig(guildId) {
	return prisma.guildEconomy.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @returns {Promise<import('../generated/prisma/client').GuildEconomy>}
 */
function ensureConfig(guildId) {
	return getConfig(guildId);
}

/**
 * @param {import("discord.js").Snowflake} guildIdyrd
 * @param {string} name
 * @returns {Promise<import('../generated/prisma/client').GuildEconomy>}
 */
function setCurrencyName(guildId, name) {
	return prisma.guildEconomy.upsert({
		where: { guildId },
		create: { guildId, currencyName: name },
		update: { currencyName: name },
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {string} name
 * @returns {Promise<import('../generated/prisma/client').GuildEconomy>}
 */
function setCurrencyPlural(guildId, name) {
	return prisma.guildEconomy.upsert({
		where: { guildId },
		create: { guildId, currencyNamePlural: name },
		update: { currencyNamePlural: name },
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {string} symbol
 * @returns {Promise<import('../generated/prisma/client').GuildEconomy>}
 */
function setCurrencySymbol(guildId, symbol) {
	return prisma.guildEconomy.upsert({
		where: { guildId },
		create: { guildId, currencySymbol: symbol },
		update: { currencySymbol: symbol },
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {Partial<import('../generated/prisma/client').GuildEconomy>} data
 * @returns {Promise<import('../generated/prisma/client').GuildEconomy>}
 */
function updateConfig(guildId, data) {
	return prisma.guildEconomy.upsert({
		where: { guildId },
		create: { guildId, ...data },
		update: data,
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @returns {Promise<import('../generated/prisma/client').GuildEconomyUser>}
 */
function ensureUser(guildId, userId) {
	return prisma.guildEconomyUser.upsert({
		where: { guildId_userId: { guildId, userId } },
		create: { guildId, userId },
		update: {},
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @returns {Promise<number>}
 */
async function getBalance(guildId, userId) {
	const row = await prisma.guildEconomyUser.findUnique({
		where: { guildId_userId: { guildId, userId } },
		select: { balance: true },
	});
	return row?.balance ?? 0;
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @param {number} amount
 * @param {string} [description]
 * @returns {Promise<import('../generated/prisma/client').GuildEconomyUser>}
 */
async function setBalance(guildId, userId, amount, description) {
	if (amount < 0) amount = 0;
	if (amount > MAX_BALANCE) amount = MAX_BALANCE;
	const old = await ensureUser(guildId, userId);
	const diff = amount - old.balance;
	const data = { balance: amount };
	if (diff > 0) data.totalEarned = { increment: diff };
	if (diff < 0) data.totalSpent = { increment: -diff };
	const row = await prisma.guildEconomyUser.update({
		where: { guildId_userId: { guildId, userId } },
		data,
	});
	await addTransaction(
		guildId,
		userId,
		"set",
		amount,
		row.balance,
		null,
		description || "Balance set",
	);
	return row;
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @param {number} amount
 * @param {string} type
 * @param {string} [description]
 * @returns {Promise<import('../generated/prisma/client').GuildEconomyUser>}
 */
async function addBalance(guildId, userId, amount, type, description) {
	if (amount < 0) amount = 0;
	if (amount > MAX_BALANCE) amount = MAX_BALANCE;
	const row = await prisma.guildEconomyUser.upsert({
		where: { guildId_userId: { guildId, userId } },
		create: { guildId, userId, balance: amount, totalEarned: amount },
		update: {
			balance: { increment: amount },
			totalEarned: { increment: amount },
		},
	});
	await addTransaction(
		guildId,
		userId,
		type,
		amount,
		row.balance,
		null,
		description || type,
	);
	return row;
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @param {number} amount
 * @param {string} type
 * @param {string} [description]
 * @returns {Promise<import('../generated/prisma/client').GuildEconomyUser>}
 */
async function removeBalance(guildId, userId, amount, type, description) {
	if (amount < 0) amount = 0;
	if (amount > MAX_BALANCE) amount = MAX_BALANCE;
	const old = await ensureUser(guildId, userId);
	if (old.balance < amount) throw new Error("Insufficient balance");
	const row = await prisma.guildEconomyUser.update({
		where: { guildId_userId: { guildId, userId } },
		data: {
			balance: { decrement: amount },
			totalSpent: { increment: amount },
		},
	});
	await addTransaction(
		guildId,
		userId,
		type,
		-amount,
		row.balance,
		null,
		description || type,
	);
	return row;
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @param {string} type
 * @param {number} amount
 * @param {number} balanceAfter
 * @param {import("discord.js").Snowflake|null} relatedUserId
 * @param {string} [description]
 * @returns {Promise<import('../generated/prisma/client').GuildEconomyTransaction>}
 */
function addTransaction(
	guildId,
	userId,
	type,
	amount,
	balanceAfter,
	relatedUserId,
	description,
) {
	return prisma.guildEconomyTransaction.create({
		data: {
			guildId,
			userId,
			type,
			amount,
			balanceAfter,
			relatedUserId,
			description: description || null,
		},
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @param {number} [page]
 * @param {number} [pageSize]
 * @returns {Promise<{rows: Array<import('../generated/prisma/client').GuildEconomyTransaction>, total: number, page: number, totalPages: number}>}
 */
async function getTransactions(guildId, userId, page, pageSize) {
	page = page || 1;
	pageSize = pageSize || 10;
	const [rows, total] = await Promise.all([
		prisma.guildEconomyTransaction.findMany({
			where: { guildId, userId },
			orderBy: { createdAt: "desc" },
			skip: (page - 1) * pageSize,
			take: pageSize,
		}),
		prisma.guildEconomyTransaction.count({ where: { guildId, userId } }),
	]);
	return { rows, total, page, totalPages: Math.ceil(total / pageSize) };
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {number} [limit]
 * @returns {Promise<Array<import('../generated/prisma/client').GuildEconomyUser>>}
 */
function getLeaderboard(guildId, limit) {
	return prisma.guildEconomyUser.findMany({
		where: { guildId },
		orderBy: { balance: "desc" },
		take: limit || 10,
	});
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @returns {Promise<number|null>}
 */
async function getRank(guildId, userId) {
	const row = await prisma.guildEconomyUser.findUnique({
		where: { guildId_userId: { guildId, userId } },
		select: { balance: true },
	});
	if (!row) return null;
	const higher = await prisma.guildEconomyUser.count({
		where: { guildId, balance: { gt: row.balance } },
	});
	return higher + 1;
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @returns {Promise<number>}
 */
function getUserCount(guildId) {
	return prisma.guildEconomyUser.count({ where: { guildId } });
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @returns {Promise<{success: boolean, amount: number, streak: number, message: string}>}
 */
async function claimDaily(guildId, userId) {
	const config = await getConfig(guildId);
	const user = await ensureUser(guildId, userId);
	const now = new Date();
	const msPerDay = config.streakResetDays * 24 * 60 * 60 * 1000;

	if (user.lastDaily) {
		const timeSince = now.getTime() - user.lastDaily.getTime();
		if (timeSince < msPerDay) {
			const next = new Date(user.lastDaily.getTime() + msPerDay);
			return {
				success: false,
				amount: 0,
				streak: 0,
				message: `Come back <t:${Math.floor(next.getTime() / 1000)}:R>`,
			};
		}
	}

	const streakDays = user.lastDaily
		? Math.floor((now.getTime() - user.lastDaily.getTime()) / msPerDay) <= 1
			? (user.streakDays || 0) + 1
			: 1
		: 1;

	const raw = config.dailyBase + streakDays * config.dailyStreakBonus;
	const amount = Math.min(raw, config.dailyCap, MAX_BALANCE);

	await prisma.guildEconomyUser.update({
		where: { guildId_userId: { guildId, userId } },
		data: {
			balance: { increment: amount },
			totalEarned: { increment: amount },
			lastDaily: now,
			streakDays: streakDays,
		},
	});

	await addTransaction(
		guildId,
		userId,
		"daily",
		amount,
		await getBalance(guildId, userId),
		null,
		"Daily claim",
	);

	return {
		success: true,
		amount,
		streak: streakDays,
		message: `Claimed ${amount}`,
	};
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @returns {Promise<{canWork: boolean, cooldownEnd: Date|null, streak: number}>}
 */
async function canWork(guildId, userId) {
	const config = await getConfig(guildId);
	const user = await ensureUser(guildId, userId);
	if (!user.lastWork) return { canWork: true, cooldownEnd: null, streak: 0 };
	const nowMs = Date.now();
	const cooldownEnd = new Date(
		user.lastWork.getTime() + config.workCooldown * 1000,
	);
	if (nowMs < cooldownEnd.getTime())
		return { canWork: false, cooldownEnd, streak: 0 };

	const elapsed = (nowMs - user.lastWork.getTime()) / 1000;
	const decay = Math.floor(elapsed / config.workStreakDecayInterval);
	const streak = Math.max(0, (user.workStreak || 0) - decay);
	return { canWork: true, cooldownEnd: null, streak };
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @param {import("discord.js").Snowflake} userId
 * @returns {Promise<{amount: number, streak: number, bonus: number, cooldownEnd: Date, message: string}>}
 */
async function doWork(guildId, userId) {
	const config = await getConfig(guildId);
	const now = new Date();

	const user = await ensureUser(guildId, userId);
	let streak = 0;
	if (user.lastWork) {
		const elapsed = (now.getTime() - user.lastWork.getTime()) / 1000;
		const decay = Math.floor(elapsed / config.workStreakDecayInterval);
		streak = Math.max(0, (user.workStreak || 0) - decay);
	}
	streak += 1;

	const base = Math.floor(Math.random() * (config.workMax - config.workMin + 1)) + config.workMin;
	const bonus = streak * config.workStreakBonus;
	const amount = base + bonus;

	await prisma.guildEconomyUser.update({
		where: { guildId_userId: { guildId, userId } },
		data: {
			balance: { increment: amount },
			totalEarned: { increment: amount },
			lastWork: now,
			workStreak: streak,
		},
	});

	await addTransaction(
		guildId,
		userId,
		"work",
		amount,
		await getBalance(guildId, userId),
		null,
		"Work",
	);

	const cooldownEnd = new Date(now.getTime() + config.workCooldown * 1000);
	return { amount, streak, bonus, cooldownEnd, message: `You worked and earned ${amount}` };
}

/**
 * @param {import("discord.js").Snowflake} guildId
 * @returns {Promise<void>}
 */
async function resetGuild(guildId) {
	await prisma.guildEconomyTransaction.deleteMany({ where: { guildId } });
	await prisma.guildEconomyUser.deleteMany({ where: { guildId } });
	await prisma.guildEconomy.delete({ where: { guildId } });
}

module.exports = {
	getConfig,
	ensureConfig,
	setCurrencyName,
	setCurrencyPlural,
	setCurrencySymbol,
	updateConfig,
	ensureUser,
	getBalance,
	setBalance,
	addBalance,
	removeBalance,
	addTransaction,
	getTransactions,
	getLeaderboard,
	getRank,
	getUserCount,
	claimDaily,
	canWork,
	doWork,
	resetGuild,
};
