const path = require("path");
const fs = require("fs");
const GIF_DIR = "L:\\reactiongifs";
const VALID_EXTS = new Set(["gif","png","jpg","jpeg","webp","mp4","webm","mov","avi","mkv","flv","wmv","m4v"]);
module.exports = { path: "/gif-tagger/api/stats", method: "get", handler: async (req, res) => {
  const prisma = req.app?.locals?.client?.db?.prisma;
  if (!prisma) return res.json({ ok: false, error: "DB not available" });
  try {
    const allFiles = fs.readdirSync(GIF_DIR).filter(f => { const ext = path.extname(f).toLowerCase().replace(".",""); return VALID_EXTS.has(ext); });
    const total = allFiles.length;
    const tagged = await prisma.reactionGif.count();
    res.json({ ok: true, done: tagged, remaining: total - tagged });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}};
