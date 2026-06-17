const path = require("path");
const fs = require("fs");

const GIF_DIR = "L:\\reactiongifs";

// ensure storage directory exists at load time
fs.mkdirSync(GIF_DIR, { recursive: true });

const MIME_TYPES = {
	gif: "image/gif",
	mp4: "video/mp4",
	webm: "video/webm",
};

module.exports = {
	path: "/reactiongifs/:id",
	method: "get",

	handler: async (req, res) => {
		try {
			const { id } = req.params;
			if (!id) return res.status(400).send("missing id");

			const client = req.app?.locals?.client;
			if (!client) return res.status(503).send("client not available");

			const db = client.db.prisma;

			// look up in both tables, ReactionGif first
			let record =
				(await db.reactionGif.findUnique({ where: { id }, select: { fileType: true } })) ||
				(await db.submittedReactonGif.findUnique({ where: { id }, select: { fileType: true } }));

			if (!record) return res.status(404).send("not found");

			const filePath = path.join(GIF_DIR, `${id}.${record.fileType}`);
			if (!fs.existsSync(filePath)) {
				return res.status(404).send("file not found on disk");
			}

			const mime = MIME_TYPES[record.fileType] || "application/octet-stream";
			res.set("Content-Type", mime);
			res.set("Cache-Control", "public, max-age=31536000, immutable");
			res.sendFile(filePath);
		} catch (err) {
			console.error(err);
			res.status(500).send("internal error");
		}
	},
};
