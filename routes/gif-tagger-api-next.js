const path = require("path");
const fs = require("fs");
const GIF_DIR = "L:\\reactiongifs";
const VALID_EXTS = new Set(["gif","png","jpg","jpeg","webp","mp4","webm","mov","avi","mkv","flv","wmv","m4v"]);
function getAllFiles() { return fs.readdirSync(GIF_DIR).filter(f => { const ext = path.extname(f).toLowerCase().replace(".",""); return VALID_EXTS.has(ext); }); }
module.exports = { path: "/gif-tagger/api/next", method: "get", handler: async (req, res) => {
  const prisma = req.app?.locals?.client?.db?.prisma;
  if (!prisma) return res.json({ ok: false, error: "DB not available" });
  try {
    const files = getAllFiles();
    if (files.length === 0) return res.json({ ok: false, error: "No files found" });
    const existing = await prisma.reactionGif.findMany({ select: { id: true } });
    const existingIds = new Set(existing.map(r => r.id));
    const uncategorized = files.filter(f => !existingIds.has(path.parse(f).name));
    if (uncategorized.length === 0) return res.json({ ok: false, error: "All done" });
    const pick = uncategorized[Math.floor(Math.random() * uncategorized.length)];
    const parsed = path.parse(pick);
    res.json({ ok: true, file: parsed.name, ext: parsed.ext.replace(".", "") });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}};
