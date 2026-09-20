const { getLogger } = require("./logger");
const {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
} = require("discord.js");

const log = getLogger("Starboard");

const IMAGE_RE = /\.(png|jpe?g|gif|webp)$/i;

/** Stable key for a reaction emoji: `name:id` for custom, unicode otherwise. */
function emojiKey(emoji) {
	return emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
}

/** Normalize a user-supplied emoji into the stored key form. */
function parseEmojiInput(input) {
	if (!input) return null;
	const custom = input.match(/^<?(a?):(\w+):(\d+)>?$/);
	if (custom) return `${custom[2]}:${custom[3]}`;
	const named = input.match(/^:(\w+):$/);
	if (named) return named[1];
	const bare = input.match(/^(\w+)$/);
	if (bare && !/[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u.test(input))
		return bare[1];
	return input;
}

async function getBoards(prisma, guildId) {
	return prisma.starboard.findMany({
		where: { guildId },
		include: { ignored: true },
	});
}

async function findBoard(prisma, guildId, emoji) {
	const key = typeof emoji === "string" ? emoji : emojiKey(emoji);
	const boards = await getBoards(prisma, guildId);
	return boards.find((b) => b.emoji === key) || null;
}

function isIgnored(board, { member, authorId, channelId }) {
	for (const ig of board.ignored) {
		if (ig.targetType === "channel" && ig.targetId === channelId) return true;
		if (ig.targetType === "member" && ig.targetId === authorId) return true;
		if (
			ig.targetType === "role" &&
			member?.roles?.cache?.has(ig.targetId)
		)
			return true;
	}
	return false;
}

async function countStars(message, board) {
	const reaction = message.reactions.cache.find(
		(r) => emojiKey(r.emoji) === board.emoji,
	);
	if (!reaction) return 0;

	const users = await reaction.users.fetch().catch(() => null);
	if (!users) return reaction.count;

	let count = 0;
	for (const u of users.values()) {
		if (u.bot) continue;
		if (!board.selfStar && u.id === message.author.id) continue;
		count++;
	}
	return count;
}

function buildPayload(board, message, count) {
	const container = new ContainerBuilder().setAccentColor(
		board.color ?? 0xffac33,
	);

	const header =
		`**${count}** ${board.emoji} <#${message.channelId}>` +
		(board.jumpUrl ? ` · [Jump](${message.url})` : "");
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(header),
	);

	if (message.content) {
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				message.content.slice(0, 1900),
			),
		);
	}

	if (board.showAttachments) {
		const images = [...message.attachments.values()]
			.filter((a) => IMAGE_RE.test(a.name || a.url))
			.slice(0, 4);
		if (images.length) {
			const gallery = new MediaGalleryBuilder().addItems(
				images.map((a) => new MediaGalleryItemBuilder().setURL(a.url)),
			);
			container.addMediaGalleryComponents(gallery);
		}
	}

	if (board.showTimestamp) {
		container.addSeparatorComponents(new SeparatorBuilder());
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`-# ${message.author.tag ?? message.author.username} · <t:${Math.floor(
					message.createdTimestamp / 1000,
				)}:R>`,
			),
		);
	}

	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
		allowedMentions: { parse: [] },
	};
}

/**
 * Recompute a starboard entry for a message and create/update/remove it.
 * @returns {Promise<void>}
 */
async function refresh(client, message, board) {
	const prisma = client.db.prisma;

	const existing = await prisma.starboardEntry
		.findUnique({
			where: {
				sourceMessageId_starboardId: {
					sourceMessageId: message.id,
					starboardId: board.id,
				},
			},
		})
		.catch(() => null);

	const count = await countStars(message, board);
	const channel = message.guild.channels.cache.get(board.channelId);

	// Below threshold — remove any existing entry
	if (count < board.threshold) {
		if (existing) {
			if (channel) {
				const msg = await channel.messages
					.fetch(existing.starboardMessageId)
					.catch(() => null);
				if (msg) await msg.delete().catch(() => {});
			}
			await prisma.starboardEntry
				.delete({ where: { id: existing.id } })
				.catch(() => {});
		}
		return;
	}

	const payload = buildPayload(board, message, count);

	// Update existing
	if (existing) {
		if (channel) {
			const msg = await channel.messages
				.fetch(existing.starboardMessageId)
				.catch(() => null);
			if (msg) {
				await msg.edit(payload).catch(() => {});
				await prisma.starboardEntry
					.update({
						where: { id: existing.id },
						data: { starCount: count },
					})
					.catch(() => {});
				return;
			}
		}
	}

	// Create new (or re-create after the original post was deleted)
	if (!channel || !channel.isTextBased()) return;

	const sent = await channel.send(payload).catch((err) => {
		log.warn(`Failed to send starboard post: ${err.message}`);
		return null;
	});
	if (!sent) return;

	await prisma.starboardEntry.upsert({
		where: {
			sourceMessageId_starboardId: {
				sourceMessageId: message.id,
				starboardId: board.id,
			},
		},
		update: { starboardMessageId: sent.id, starCount: count },
		create: {
			guildId: message.guild.id,
			starboardId: board.id,
			sourceMessageId: message.id,
			sourceChannelId: message.channelId,
			starboardMessageId: sent.id,
			starCount: count,
		},
	});
}

/** Handle a reaction being added on a message. */
async function handleAdd(client, reaction, user) {
	const message = reaction.message;
	if (!message.guild) return;

	const prisma = client.db.prisma;
	const board = await findBoard(prisma, message.guild.id, reaction.emoji);
	if (!board) return;

	if (user.bot) return;

	// Ignore starboard-channel stars to avoid loops
	if (message.channelId === board.channelId) return;

	const full = message.partial ? await message.fetch().catch(() => null) : message;
	if (!full) return;

	if (isIgnored(board, {
		member: full.member,
		authorId: full.author.id,
		channelId: full.channelId,
	}))
		return;

	await refresh(client, full, board);
}

/** Handle a reaction being removed from a message. */
async function handleRemove(client, reaction, user) {
	const message = reaction.message;
	if (!message.guild) return;

	const prisma = client.db.prisma;
	const board = await findBoard(prisma, message.guild.id, reaction.emoji);
	if (!board) return;
	if (message.channelId === board.channelId) return;

	const full = message.partial ? await message.fetch().catch(() => null) : message;
	if (!full) return;

	await refresh(client, full, board);
}

module.exports = {
	emojiKey,
	parseEmojiInput,
	getBoards,
	findBoard,
	isIgnored,
	countStars,
	buildPayload,
	refresh,
	handleAdd,
	handleRemove,
};
