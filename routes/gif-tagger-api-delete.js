const path = require("path");
const fs = require("fs");
const { requireOwner } = require("../lib/ownerGuard");
const GIF_DIR = "L:\\reactiongifs";
module.exports = { path: "/gif-tagger/api/delete", method: "post", handler: async (req, res) => {
  try {
    const guard = requireOwner(req);
    if (!guard.ok) return res.status(guard.status).json({ ok: false, error: guard.error });
    const { file } = req.body;
    if (!file) return res.json({ ok: false, error: "Missing file" });
    const resolved = path.resolve(GIF_DIR, file);
    if (!resolved.startsWith(GIF_DIR)) return res.json({ ok: false, error: "Invalid path" });
    const files = fs.readdirSync(GIF_DIR).filter(f => f.startsWith(file + "."));
    if (files.length === 0) return res.json({ ok: false, error: "File not found" });
    for (const f of files) fs.unlinkSync(path.join(GIF_DIR, f));
    res.json({ ok: true });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}};
