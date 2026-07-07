const { Events, Client, Message } = require("discord.js");
const { getLogger } = require("../lib/logger");
const logger = require("../lib/logger");

const log = getLogger("anti Spam");
/**
/**
 * A tracked message that can be deleted later.
 *
 * @typedef {Object} TrackedMessage
 * @property {string} channelId The ID of the channel the message was sent in.
 * @property {string} messageId The ID of the message.
 */

/**
 * Stores per-user spam delay information.
 *
 * @typedef {Object} DelayData
 * @property {number} last Timestamp (ms since Unix epoch) of the user's last message.
 * @property {number} heatlvl The user's current spam heat level.
 * @property {string} lastChannel The last channel the user spoke in for easy look up
 * @property {TrackedMessage[]} messages The user's recently tracked messages.
 */

/**
 * Maps a user ID to their spam delay data.
 *
 * @type {Map<string, DelayData>}
 */
const delayMap = new Map();
const tolerance = 3;
const decayAmount = 1; // set to infiinty or a large number to instnatly decay all
const toleranceReset = 4 * 1000; // 4 secs
const CassiesServer = "1489809097401307340";
const logChannelId = "1523825653638496307";
const offenderRole = "1523497783523414066";
module.exports = {
	name: Events.MessageCreate,
	description:
		"auto bonks members that spam across channels (only for my server right now)",

	/**
	 * @param {Client} client
	 * @param {Message} message
	 */
	async execute(client, message) {
		if (message.author.id == client.user.id) return;
		if (!message.guild) return;

		if (message.guild.id !== CassiesServer) return; // only enforce this in her server maybe will add to all servers as a feature later
		const current = delayMap.get(message.author.id);
		if (!current) {
			log.debug(
				`Tracking ${message.author.tag} (${message.author.id}) first message in #${message.channel.name}`,
			);
			return delayMap.set(message.author.id, {
				last: Date.now(),
				heatlvl: 1,
				lastChannel: message.channelId,
				messages: [
					{ channelId: message.channelId, messageId: message.id },
				],
			}); // initlize it
		}

		if (current.lastChannel == message.channelId) return; // return early they are talking normally
		log.debug(
			`${message.author.tag} moved channels: ${current.lastChannel} -> ${message.channelId}`,
		);
		if (Date.now() - current.last > toleranceReset) {
			log.debug(
				`Resetting spam heat for ${message.author.tag}. Old heat: ${current.heatlvl}, new heat: ${Math.max(current.heatlvl - decayAmount, 0)}`,
			);

			return delayMap.set(message.author.id, {
				last: Date.now(),
				lastChannel: message.channelId,
				heatlvl: Math.max(current.heatlvl - decayAmount, 0),
				messages: [
					...current.messages.slice(1),
					{ channelId: message.channelId, messageId: message.id },
				],
			});
		}
		// they send within the tolerace reset !!!!!!
		//check if they breached the limit
		if (current.heatlvl + 1 > tolerance) {
			log.warn(
				`Spam detected: ${message.author.tag} (${message.author.id}) exceeded tolerance. Heat: ${current.heatlvl + 1}/${tolerance}`,
			);
			await message.member.roles
				.add(offenderRole)
				.then(() => {
					log.info(
						`Added spam offender role to ${message.author.tag} (${message.author.id})`,
					);
				})
				.catch((e) => {
					log.error(
						`Failed adding spam role to ${message.author.tag}:`,
						e,
					);
				});
			const logChannel = await message.guild.channels.fetch(logChannelId);
			if (!logChannel)
				log.warn(
					`mod channel ${logChannelId} can not be found in the server: ${message.guildId} logs wont be sent`,
				);
			current.messages.push({
				channelId: message.channelId,
				messageId: message.id,
			});
			for (const { channelId, messageId } of current.messages) {
				// redownload all attachments in memory because you cant link them as they will be deleted

				const currentChannel =
					await message.guild.channels.fetch(channelId);
				if (
					!currentChannel ||
					!currentChannel.isTextBased() || //force my ide to do types because yea it doesnt know why type of channel this is
					!currentChannel.messages
				) {
					log.warn(
						`failed to delete message:  channel ${channelId} not found in server: ${message.guildId}`,
					);
					continue;
				}

				const currentMessage = await currentChannel.messages
					.fetch(messageId)
					.catch(() => null);

				if (!currentMessage) continue;
				log.info(
					`Logging deleted message ${messageId} from ${currentMessage.author.tag} in ${channelId}`,
				);
				const files = await Promise.all(
					[...currentMessage.attachments.values()].map(
						async (attachment) => {
							const res = await fetch(attachment.url);
							const buffer = Buffer.from(await res.arrayBuffer());

							return {
								attachment: buffer,
								name: attachment.name ?? "attachment",
							};
						},
					),
				);
				if (!logChannel || !logChannel.isTextBased()) continue;
				await logChannel.send({
					content: `Deleted message from ${message.author.tag} \n content: ${currentMessage.content} \n author: <@${currentMessage.author.id}>( ${currentMessage.author.displayName})`,
					files,
				});
				await currentMessage
					.delete()
					.then(() => {
						log.debug(`Deleted spam message ${messageId}`);
					})
					.catch((e) => {
						log.error(`Failed deleting ${messageId}:`, e);
					});
			}
			await message.channel.send(
				`<@${message.author.id}>!!! you have been BONKED for spamming across channels your upload abilities have been removed and mods have been notified this is due to the recent mister beast scams if this is a false alarm no worries a mod will remove it if you did nothing wrong `,
			);
			return delayMap.set(message.author.id, {
				last: Date.now(),
				lastChannel: message.channelId,
				heatlvl: 0,
				messages: [],
			});
		}

		return delayMap.set(message.author.id, {
			last: Date.now(),
			lastChannel: message.channelId,
			heatlvl: current.heatlvl + 1,
			messages: [
				...current.messages,
				{ channelId: message.channelId, messageId: message.id },
			],
		});
	},
};
