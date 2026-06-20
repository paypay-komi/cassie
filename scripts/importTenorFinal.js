/**
 * Final pass — fill remaining actions still below 10 GIFs.
 * Usage: node scripts/importTenorFinal.js
 */

require("dotenv/config");
const { PrismaClient } = require("../generated/prisma/client.ts");
const { PrismaPg } = require("@prisma/adapter-pg");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const sharp = require("sharp");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const GIF_DIR = "L:\\reactiongifs";
const API_KEY = "AIzaSyCZt6SSh5VgVPzD9fhyzG1DprdPRhtoaR4";
const API_BASE = "https://tenor.googleapis.com/v2";
const PER_ACTION = 20;

const ACTIONS = [
  { a: "flex", q: ["anime flex", "anime flexing", "flex muscle anime"] },
  { a: "faint", q: ["anime faint", "anime fainting", "pass out anime"] },
  { a: "swoon", q: ["anime swoon", "anime melting", "swoon anime"] },
  { a: "shiver", q: ["anime shiver", "anime trembling", "anime cold"] },
  { a: "cower", q: ["anime cower", "anime cowering", "anime scared"] },
  { a: "slide", q: ["anime slide", "anime sliding", "slide anime"] },
  { a: "hop", q: ["anime hop", "anime hopping", "hop anime"] },
  { a: "skip", q: ["anime skip", "anime skipping", "skip anime"] },
  { a: "jump", q: ["anime jump", "anime jumping", "jump for joy anime"] },
  { a: "dodge", q: ["anime dodge", "anime dodging", "dodge anime"] },
  { a: "spin", q: ["anime spin", "anime spinning", "spin anime"] },
  { a: "carry", q: ["anime carry", "anime carrying", "bridal carry anime"] },
  { a: "handshake", q: ["anime handshake", "shaking hands anime"] },
  { a: "stare", q: ["anime stare", "anime staring", "intense stare anime"] },
  { a: "glare", q: ["anime glare", "anime glaring", "angry stare anime"] },
  { a: "sweat", q: ["anime sweat", "anime sweating", "nervous sweat anime"] },
  { a: "shoo", q: ["anime shoo", "go away anime", "shoo away anime"] },
  { a: "peek", q: ["anime peek", "anime peeking", "peekaboo anime"] },
  { a: "tea", q: ["anime tea", "drinking tea anime", "tea party anime"] },
  { a: "coffee", q: ["anime coffee", "drinking coffee anime"] },
  { a: "slam", q: ["anime slam", "anime slamming", "slam table anime"] },
  { a: "yeet", q: ["anime yeet", "anime throw", "toss anime"] },
  { a: "tease", q: ["anime tease", "anime teasing", "bully anime"] },
  { a: "shrug", q: ["anime shrug", "anime shrugging", "i dunno anime"] },
  { a: "gasp", q: ["anime gasp", "shocked anime", "surprised anime"] },
];

function toSigned64(val) { return val >= (1n << 63n) ? val - ((1n << 63n) << 1n) : val; }
async function gifToPngBuffer(fp) { if (!/\.gif$/i.test(fp)) return null; const g = require("gif-frames"); const f = await g({ url: fp, frames: 0, outputType: "png" }); const s = f[0].getImage(); return new Promise((r) => { const c = []; s.on("data", d => c.push(d)); s.on("end", () => r(Buffer.concat(c))); }); }
async function hashImage(fp) { const buf = await gifToPngBuffer(fp); const input = buf || fp; const { data } = await sharp(input).resize(8,8,{fit:"fill"}).grayscale().raw().toBuffer({resolveWithObject:true}); let sum = 0; for (let i=0;i<64;i++) sum+=data[i]; const avg=sum/64; let bits=0n; for (let i=0;i<64;i++) if (data[i]>avg) bits |= 1n << BigInt(i); return { hex: bits.toString(16).padStart(16,"0"), bigint: toSigned64(bits) }; }
async function nearDup(ph, t=10) { const r = await prisma.$queryRaw`SELECT id, hash, BIT_COUNT(("mediaHash" # ${ph})::bit(64)) AS d FROM (SELECT id, hash, "mediaHash" FROM "ReactionGif" WHERE "mediaHash" IS NOT NULL UNION ALL SELECT id, hash, "mediaHash" FROM "SubmittedReactonGif" WHERE "mediaHash" IS NOT NULL) c WHERE BIT_COUNT(("mediaHash" # ${ph})::bit(64)) <= ${t} ORDER BY d LIMIT 1`; return r?.[0] ? { id: r[0].id, hash: r[0].hash } : null; }
async function download(url, dest) { const w = fs.createWriteStream(dest); const r = await axios({method:"get",url,responseType:"stream",timeout:30000}); await new Promise((res,rej) => { w.on("finish",res); w.on("error",rej); r.data.pipe(w); }); }

async function main() {
  fs.mkdirSync(GIF_DIR, { recursive: true });
  console.log(`=== Tenor Anime Final Pass [${PER_ACTION} per, ${ACTIONS.length} actions] ===\n`);

  const existing = await prisma.reactionGif.findMany({ select: { hash: true } });
  const sub = await prisma.submittedReactonGif.findMany({ select: { hash: true } });
  const dupSet = new Set([...existing.map(r=>r.hash), ...sub.map(r=>r.hash)]);

  let total = 0, totalDups = 0, totalErr = 0, start = Date.now();

  for (const entry of ACTIONS) {
    let actCount = 0, actDups = 0, actErr = 0, seen = new Set();
    for (const query of entry.q) {
      if (actCount >= PER_ACTION) break;
      let pos = null;
      while (actCount < PER_ACTION) {
        try {
          const url = `${API_BASE}/search?q=${encodeURIComponent(query)}&key=${API_KEY}&client_key=reaction_bot&limit=20&contentfilter=low${pos ? `&pos=${encodeURIComponent(pos)}` : ""}`;
          const { data } = await axios.get(url, { timeout: 10000 });
          if (!data.results?.length) break;
          for (const r of data.results) {
            if (actCount >= PER_ACTION) break;
            const gifUrl = r.media_formats?.gif?.url;
            if (!gifUrl) continue;
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            const tmp = path.join(os.tmpdir(), `tenor_${r.id}.gif`);
            try {
              await download(gifUrl, tmp);
              const sha = await new Promise((res,rej) => { const h=crypto.createHash("sha256"); fs.createReadStream(tmp).on("data",d=>h.update(d)).on("end",()=>res(h.digest("hex"))).on("error",rej); });
              if (dupSet.has(sha)) { fs.unlink(tmp,()=>{}); actDups++; continue; }
              const ph = await hashImage(tmp);
              const nd = await nearDup(ph.bigint);
              if (nd) { fs.unlink(tmp,()=>{}); actDups++; continue; }
              const rec = await prisma.reactionGif.create({ data: { hash: sha, actions: [entry.a], fileType: "gif", mediaHash: ph.bigint } });
              fs.copyFileSync(tmp, path.join(GIF_DIR, `${rec.id}.gif`));
              fs.unlink(tmp,()=>{});
              dupSet.add(sha);
              actCount++;
            } catch(e) { actErr++; try { fs.unlink(tmp,()=>{}); } catch {} }
          }
          pos = data.next;
          if (!pos) break;
        } catch(e) {
          if (e.response?.status === 429) { await new Promise(r=>setTimeout(r,2000)); continue; }
          break;
        }
      }
    }
    total += actCount; totalDups += actDups; totalErr += actErr;
    console.log(`[${entry.a.padEnd(12)}] +${actCount} dup:${actDups} err:${actErr} | total: ${total}`);
  }

  const dur = Math.round((Date.now()-start)/1000);
  const final = await prisma.reactionGif.count();
  console.log(`\n=== Done === +${total} (${totalErr} err) | Total: ${final} | ${dur}s`);
  await prisma.$disconnect();
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
