const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { hashImage, findNearDuplicate } = require("../utils/perceptualHash");
const GIF_DIR = "L:\\reactiongifs";
module.exports = { path: "/gif-tagger/api/save", method: "post", handler: async (req, res) => {
  const prisma = req.app?.locals?.client?.db?.prisma;
  if (!prisma) return res.json({ ok: false, error: "DB not available" });
  try {
    const { file, actions } = req.body;
    if (!file || !Array.isArray(actions) || actions.length === 0) return res.json({ ok: false, error: "Invalid request" });

    const diskFiles = fs.readdirSync(GIF_DIR).filter(f => f.startsWith(file + "."));
    if (diskFiles.length === 0) return res.json({ ok: false, error: "File not found" });

    const ext = path.extname(diskFiles[0]).replace(".", "");
    const filePath = path.join(GIF_DIR, diskFiles[0]);

    const sha256 = await new Promise((res, rej) => {
      const h = crypto.createHash("sha256");
      fs.createReadStream(filePath).on("data", d => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej);
    });

    const existing = await prisma.reactionGif.findUnique({ where: { hash: sha256 }, select: { id: true } });
    if (existing) return res.json({ ok: false, error: "Exact duplicate already exists" });

    const phash = await hashImage(filePath);
    const nearDup = await findNearDuplicate(prisma, phash);
    if (nearDup) return res.json({ ok: false, error: "Near-duplicate already exists" });

    await prisma.reactionGif.upsert({
      where: { id: file },
      create: { id: file, hash: sha256, actions, fileType: ext, mediaHash: phash.bigint },
      update: { hash: sha256, actions, fileType: ext, mediaHash: phash.bigint },
    });

    res.json({ ok: true });
  } catch (err) { res.json({ ok: false, error: err.message }); }
}};
