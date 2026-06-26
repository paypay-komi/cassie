const sharp = require("sharp");
const GIFEncoder = require("gif-encoder");

const SYMBOL_GLYPHS = {
	"🍒": '<circle cx="-6" cy="-2" r="9" fill="#e74c3c"/><circle cx="6" cy="-2" r="9" fill="#e74c3c"/><path d="M0-11Q-6-22 2-24" stroke="#27ae60" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
	"🍋": '<ellipse cx="0" cy="0" rx="14" ry="9" fill="#f1c40f" transform="rotate(-15)"/><ellipse cx="0" cy="1" rx="10" ry="5" fill="#f39c12" opacity="0.3"/>',
	"🍊": '<circle cx="0" cy="0" r="13" fill="#e67e22"/><path d="M0-13Q-4-18 0-20Q4-18 0-13" fill="#27ae60"/>',
	"🍇": '<circle cx="-8" cy="6" r="6" fill="#8e44ad"/><circle cx="0" cy="10" r="6" fill="#9b59b6"/><circle cx="8" cy="6" r="6" fill="#8e44ad"/><circle cx="-4" cy="-2" r="5" fill="#9b59b6"/><circle cx="4" cy="-2" r="5" fill="#8e44ad"/><circle cx="0" cy="-10" r="5" fill="#9b59b6"/><path d="M0-15Q-6-24 0-26Q6-24 0-15" stroke="#27ae60" stroke-width="2" fill="none"/>',
	"🔔": '<path d="M-10-8L-14 14L14 14L10-8Z" fill="#f39c12"/><circle cx="0" cy="16" r="4" fill="#f39c12"/><rect x="-4" y="16" width="8" height="4" rx="2" fill="#f39c12"/>',
	"💎": '<path d="M0-16L-14 0L0 16L14 0Z" fill="#00d2ff"/><path d="M0-16L-14 0L0 16Z" fill="#00bcd4"/>',
	"7️⃣": '<text x="0" y="10" font-size="30" font-weight="bold" fill="#e74c3c" text-anchor="middle" font-family="Arial,sans-serif">7</text>',
	"💀": '<line x1="-12" y1="-14" x2="12" y2="14" stroke="#95a5a6" stroke-width="3" stroke-linecap="round"/><line x1="12" y1="-14" x2="-12" y2="14" stroke="#95a5a6" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="0" r="11" fill="#ecf0f1"/><circle cx="-4" cy="-4" r="3" fill="#2c3e50"/><circle cx="4" cy="-4" r="3" fill="#2c3e50"/><path d="M-1 2L0 5 1 2" fill="#2c3e50"/><rect x="-4" y="6" width="8" height="2" rx="1" fill="#2c3e50"/>',
};

function pick(reels) {
	const total = reels.reduce((s, r) => s + r.weight, 0);
	let r = Math.random() * total;
	for (const entry of reels) {
		r -= entry.weight;
		if (r <= 0) return entry.sym;
	}
	return reels[reels.length - 1].sym;
}

function frameSvg(grid, cellSize) {
	const rows = grid.length;
	const cols = grid[0].length;
	const w = cols * cellSize;
	const h = rows * cellSize;
	const scale = cellSize / 48;
	let svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
	<rect width="${w}" height="${h}" fill="#1a1a2e"/>`;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = c * cellSize;
			const y = r * cellSize;
			const cx = x + cellSize / 2;
			const cy = y + cellSize / 2;
			const glyph = SYMBOL_GLYPHS[grid[r][c]] || "";
			svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${Math.round(cellSize * 0.08)}" fill="#16213e" stroke="#0f3460" stroke-width="${Math.max(1, Math.round(cellSize / 32))}"/>
		<g transform="translate(${cx},${cy}) scale(${scale})">${glyph}</g>`;
		}
	}
	svg += "</svg>";
	return svg;
}

async function svgToRgba(svg, w, h) {
	return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
}

async function renderSlotGif(reels, finalGrid, opts = {}) {
	const {
		numReels = 3,
		reelHeight = 3,
		spinPerReel = 3,
		frameDelay = 80,
		cellSize = 48,
	} = opts;

	const frames = [];
	for (let col = 0; col < numReels; col++) {
		for (let spin = 0; spin < spinPerReel; spin++) {
			const grid = Array.from({ length: reelHeight }, (_, r) =>
				Array.from({ length: numReels }, (_, c) =>
					c < col ? finalGrid[r][c] : pick(reels),
				),
			);
			frames.push(grid);
		}
	}
	const finalFrame = finalGrid.map((r) => [...r]);
	for (let i = 0; i < 3; i++) frames.push(finalFrame);

	const w = numReels * cellSize;
	const h = reelHeight * cellSize;

	return new Promise((resolve, reject) => {
		const encoder = new GIFEncoder(w, h);
		encoder.setDelay(frameDelay);
		encoder.setRepeat(-1);
		encoder.setQuality(1);

		const chunks = [];
		encoder.on("data", (c) => chunks.push(c));
		encoder.on("end", () => resolve(Buffer.concat(chunks)));
		encoder.on("error", reject);

		encoder.writeHeader();

		(async () => {
			try {
				for (const grid of frames) {
					const svg = frameSvg(grid, cellSize);
					encoder.addFrame(await svgToRgba(svg, w, h));
				}
				encoder.finish();
			} catch (err) {
				reject(err);
			}
		})();
	});
}

module.exports = { renderSlotGif };
