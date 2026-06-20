const path = require("path");
const fs = require("fs");

const GIF_DIR = "L:\\reactiongifs";

// ensure storage directory exists at load time
fs.mkdirSync(GIF_DIR, { recursive: true });

const MIME_TYPES = {
	// images
	gif: "image/gif",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	bmp: "image/bmp",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	tiff: "image/tiff",
	tif: "image/tiff",
	avif: "image/avif",
	// video
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	avi: "video/x-msvideo",
	mkv: "video/x-matroska",
	flv: "video/x-flv",
	wmv: "video/x-ms-wmv",
	m4v: "video/mp4",
	// audio
	mp3: "audio/mpeg",
	mp2: "audio/mpeg",
	mp1: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	flac: "audio/flac",
	m4a: "audio/mp4",
	aac: "audio/aac",
	wma: "audio/x-ms-wma",
	// executables / binaries
	exe: "application/x-msdownload",
	dll: "application/x-msdownload",
	msi: "application/x-msdownload",
	// text
	json: "application/json",
	xml: "application/xml",
	pdf: "application/pdf",
	zip: "application/zip",
	rar: "application/vnd.rar",
	"7z": "application/x-7z-compressed",
	txt: "text/plain",
	css: "text/css",
	html: "text/html",
	js: "text/javascript",
};

/**
 * Return an HTML page with OG tags for Discord embeds + visible body for browser visitors.
 * MUST return 200 — Discord's crawler ignores non-2xx for embeds.
 */
function embedPage(title, description, color = "#ff0000", imageUrl = null) {
	const imageTag = imageUrl
		? `<meta property="og:image" content="${escapeHtml(imageUrl)}">`
		: "";
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:color" content="${color}">
${imageTag}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; font-family: system-ui, -apple-system, sans-serif;
    background: #2f3136; color: #dcddde;
  }
  .card {
    background: #36393f; border-radius: 8px; padding: 32px 40px;
    max-width: 480px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,.2);
  }
  h1 { font-size: 24px; margin-bottom: 12px; }
  p  { font-size: 16px; color: #b9bbbe; line-height: 1.5; }
</style>
</head>
<body>
<div class="card">
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
</div>
</body>
</html>`;
}

function escapeHtml(str) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/** A tiny placeholder image as data URI so Discord always has something to display */
const FALLBACK_IMAGE =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%232f3136'/%3E%3Ctext x='100' y='115' text-anchor='middle' font-size='48' fill='%23b9bbbe'%3E%E2%9D%8C%3C/text%3E%3C/svg%3E";

function traversalBlockPage() {
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="twitter:card" content="summary_large_image">
<meta property="og:title" content="Nice try 👋">
<meta property="og:description" content="NICE TRY TRYING TO ESCAPE I FIXED THAT ISSUE">
<meta property="og:color" content="#ff0000">
<meta property="og:image" content="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%232f3136'/%3E%3Ctext x='100' y='115' text-anchor='middle' font-size='48' fill='%23b9bbbe'%3E%F0%9F%91%8B%3C/text%3E%3C/svg%3E">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; font-family: system-ui, -apple-system, sans-serif;
    background: #2f3136; color: #dcddde;
  }
  .card {
    background: #36393f; border-radius: 8px; padding: 32px 40px;
    max-width: 520px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,.2);
  }
  h1 { font-size: 32px; margin-bottom: 12px; }
  p  { font-size: 18px; color: #b9bbbe; line-height: 1.5; font-family: monospace; }
</style>
</head>
<body>
<div class="card">
  <h1>👋 Nice try</h1>
  <p>NICE TRY TRYING TO ESCAPE I FIXED THAT ISSUE</p>
</div>
</body>
</html>`;
}

module.exports = {
	path: "/reactiongifs/:id.:ext",
	method: "get",

	handler: async (req, res) => {
		try {
			const { id, ext } = req.params;

			if (!id || !ext) {
				return res
					.status(200)
					.set("Content-Type", "text/html")
					.set("Cache-Control", "no-cache")
					.send(
						embedPage(
							"Bad Request",
							"Missing file ID or extension",
							"#ff0000",
							FALLBACK_IMAGE,
						),
					);
			}

			const filePath = path.join(GIF_DIR, `${id}.${ext}`);

			// ensure resolved path is inside the reaction GIF directory
			if (!filePath.startsWith(GIF_DIR)) {
				return res
					.status(200)
					.set("Content-Type", "text/html")
					.set("Cache-Control", "no-cache")
					.send(traversalBlockPage());
			}

			if (!fs.existsSync(filePath)) {
				return res
					.status(200)
					.set("Content-Type", "text/html")
					.set("Cache-Control", "no-cache")
					.send(
						embedPage(
							"Not Found",
							`This reaction ${ext} doesn't exist — it may have been removed or the link is wrong.`,
							"#ff0000",
							FALLBACK_IMAGE,
						),
					);
			}

			const mime = MIME_TYPES[ext] || "application/octet-stream";
			res.set("Content-Type", mime);
			res.set("Cache-Control", "public, max-age=31536000, immutable");
			res.sendFile(filePath);
		} catch (err) {
			console.error(err);
			res.status(200)
				.set("Content-Type", "text/html")
				.set("Cache-Control", "no-cache")
				.send(
					embedPage(
						"Error",
						"An internal server error occurred",
						"#ff0000",
						FALLBACK_IMAGE,
					),
				);
		}
	},
};
