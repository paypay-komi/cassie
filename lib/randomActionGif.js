const path = require("path");
const db = require("../db");

const BASE = (
	process.env.BASE_URL || "https://nekomi.tailef6033.ts.net"
).replace(/\/+$/, "");
const GIF_DIR = "L:\\reactiongifs";

async function getRandomActionGif(action) {
	const count = await db.prisma.reactionGif.count({
		where: { actions: { has: action } },
	});
	if (count === 0) return null;

	const skip = Math.floor(Math.random() * count);

	const gif = await db.prisma.reactionGif.findFirst({
		where: { actions: { has: action } },
		skip,
	});

	if (!gif) return null;

	return {
		url: `${BASE}/reactiongifs/${gif.id}.${gif.fileType}`,
		id: gif.id,
		fileType: gif.fileType,
		filePath: path.join(GIF_DIR, `${gif.id}.${gif.fileType}`),
	};
}

module.exports = { getRandomActionGif };
