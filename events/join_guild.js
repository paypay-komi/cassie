const { Events, EmbedBuilder } = require("discord.js");
const { getLogger } = require("../lib/logger");

module.exports = {

	name: Events.GuildCreate,
	async execute(client, guild) {
		const log = getLogger("GuildJoin");

		// Only DM owners from shard 0 to prevent duplicate DMs
		if (client.shard && client.shard.ids[0] !== 0) return;

		log.info(`Joined guild: ${guild.name} (${guild.id})`);

		// DM all bot owners
		if (!client.owners?.length) return;

		const owner = await guild.fetchOwner().catch(() => null);

		const embed = new EmbedBuilder()
			.setTitle("Joined a Server")
			.setColor(0x57F287)
			.setThumbnail(guild.iconURL())
			.addFields(
				{ name: "Name", value: guild.name, inline: true },
				{ name: "ID", value: guild.id, inline: true },
				{ name: "Members", value: guild.memberCount.toLocaleString(), inline: true },
				{ name: "Owner", value: owner ? `${owner.user.tag} (${owner.id})` : "Unknown", inline: false },
			)
			.setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
			.setTimestamp();

		for (const ownerId of client.owners) {
			const user = await client.users.fetch(ownerId).catch(() => null);
			if (user) user.send({ embeds: [embed] }).catch(() => {});
		}
	},
};
