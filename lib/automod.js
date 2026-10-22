async function ensureConfig(prisma, guildId) {
	return prisma.automodConfig.upsert({
		where: { guildId },
		create: { guildId },
		update: {},
	});
}

module.exports = { ensureConfig };
