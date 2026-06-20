/**
 * Tenor anime import — fills actions with <10 GIFs.
 * Usage: node scripts/importTenorRemaining.js
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
const MAX_SIGNED_64 = 1n << 63n;
const PER_ACTION = 20;

// Actions with <10 GIFs + their anime search queries
const ACTIONS = [
  { a: "lick", q: ["anime lick", "anime licking", "lick anime"] },
  { a: "slap", q: ["anime slap", "anime slapping", "slap anime"] },
  { a: "kill", q: ["anime kill", "anime murder", "anime death glare", "kill anime"] },
  { a: "hide", q: ["anime hide", "anime hiding", "anime scared hide", "hide anime"] },
  { a: "creep", q: ["anime creepy", "anime creep", "creep anime"] },
  { a: "sneak", q: ["anime sneak", "anime sneaking", "anime stealth", "sneak anime"] },
  { a: "bow", q: ["anime bow", "anime bowing", "bow anime"] },
  { a: "beg", q: ["anime beg", "anime begging", "anime plead", "pleading anime"] },
  { a: "salute", q: ["anime salute", "anime saluting", "salute anime"] },
  { a: "somersault", q: ["anime somersault", "anime roll", "somersault anime"] },
  { a: "juggle", q: ["anime juggle", "anime juggling", "juggle anime"] },
  { a: "balance", q: ["anime balance", "anime balancing", "balance anime"] },
  { a: "magic", q: ["anime magic", "anime magician", "magic trick anime"] },
  { a: "levitate", q: ["anime levitate", "anime floating", "anime float", "levitate anime"] },
  { a: "tpose", q: ["anime t pose", "anime tpose", "t pose anime"] },
  { a: "crab", q: ["anime crab walk", "crab dance anime", "anime crab"] },
  { a: "shuffle", q: ["anime shuffle dance", "anime shuffle", "shuffle anime"] },
  { a: "moonwalk", q: ["anime moonwalk", "moonwalk anime", "michael jackson anime"] },
  { a: "cook", q: ["anime cooking", "anime cook", "cooking anime"] },
  { a: "bake", q: ["anime baking", "bake anime", "anime bake cake"] },
  { a: "pet", q: ["anime petting", "anime pet head", "headpat anime"] },
  { a: "walk", q: ["anime walking", "walk anime", "anime walk cycle"] },
  { a: "brush", q: ["anime brushing hair", "brush teeth anime", "anime brush"] },
  { a: "wash", q: ["anime washing hands", "anime wash face", "wash anime"] },
  { a: "dry", q: ["anime drying hair", "anime dry off", "dry anime"] },
  { a: "burp", q: ["anime burp", "anime burping", "burp anime"] },
  { a: "snap", q: ["anime snap fingers", "anime snapping", "snap anime"] },
  { a: "wreck", q: ["anime wreck", "anime destroy", "anime trash", "wreck anime"] },
  { a: "smash", q: ["anime smash", "anime slam", "smash anime"] },
  { a: "destroy", q: ["anime destroy", "anime destruction", "destroy anime"] },
  { a: "trash", q: ["anime trash", "anime garbage", "trash anime"] },
  { a: "dab", q: ["anime dab", "anime dabbing", "dab anime"] },
  { a: "flex", q: ["anime flex", "anime flexing", "flex muscle anime"] },
  { a: "faint", q: ["anime faint", "anime fainting", "pass out anime", "faint anime"] },
  { a: "swoon", q: ["anime swoon", "anime melting", "swoon anime"] },
  { a: "shiver", q: ["anime shiver", "anime trembling", "anime cold shiver", "shiver anime"] },
  { a: "cower", q: ["anime cower", "anime cowering", "anime scared", "cower anime"] },
  { a: "slide", q: ["anime slide", "anime sliding", "slide anime"] },
  { a: "hop", q: ["anime hop", "anime hopping", "hop anime"] },
  { a: "skip", q: ["anime skip", "anime skipping", "skip anime"] },
  { a: "jump", q: ["anime jump", "anime jumping", "jump for joy anime"] },
  { a: "dodge", q: ["anime dodge", "anime dodging", "dodge anime"] },
  { a: "spin", q: ["anime spin", "anime spinning", "spin anime"] },
  { a: "carry", q: ["anime carry", "anime carrying", "anime bridal carry", "carry anime"] },
  { a: "handshake", q: ["anime handshake", "anime shaking hands", "handshake anime"] },
  { a: "stare", q: ["anime stare", "anime staring", "anime intense stare", "stare anime"] },
  { a: "glare", q: ["anime glare", "anime glaring", "anime angry stare", "glare anime"] },
  { a: "sweat", q: ["anime sweat", "anime sweating", "anime nervous sweat"] },
  { a: "peek", q: ["anime peek", "anime peeking", "anime peekaboo", "peek anime"] },
  { a: "nom", q: ["anime nom", "anime eating", "anime chew", "nom anime"] },
  { a: "facepalm", q: ["anime facepalm", "anime face palm", "facepalm anime"] },
  { a: "feed", q: ["anime feed", "anime feeding", "anime feed each other"] },
  { a: "shoo", q: ["anime shoo", "anime go away", "anime shoo away"] },
  { a: "tickle", q: ["anime tickle", "anime tickling", "tickle anime"] },
  { a: "tea", q: ["anime tea", "anime drinking tea", "tea party anime"] },
  { a: "coffee", q: ["anime coffee", "anime drinking coffee", "coffee anime"] },
  { a: "slam", q: ["anime slam", "anime slamming", "anime smash", "slam anime"] },
  { a: "yeet", q: ["anime yeet", "anime throw", "anime tossing", "yeet anime"] },
  { a: "tease", q: ["anime tease", "anime teasing", "anime bully", "tease anime"] },
  { a: "gasp", q: ["anime gasp", "anime shocked", "anime surprised", "gasp anime"] },
  { a: "run", q: ["anime run", "anime running", "anime sprint", "run anime"] },
  { a: "shrug", q: ["anime shrug", "anime shrugging", "anime i dunno"] },
  { a: "bonk", q: ["anime bonk", "anime bonking", "anime hit head", "bonk anime"] },
  { a: "mad", q: ["anime mad", "anime angry", "anime rage", "mad anime"] },
  { a: "crashout", q: ["anime crashout", "anime angry outburst"] },
  { a: "rage", q: ["anime rage", "anime furious", "anime angy", "rage anime"] },
  { a: "blowkiss", q: ["anime blow kiss", "anime blowing kiss", "blow kiss anime"] },
  { a: "handhold", q: ["anime handhold", "anime holding hands", "hand hold anime"] },
];

function toSigned64(val) { return val >= (1n << 63n) ? val - ((1n << 63n) << 1n) : val; }
async function gifToPngBuffer(fp) { if (!/\.gif$/i.test(fp)) return null; const g = require("gif-frames"); const f = await g({ url: fp, frames: 0, outputType: "png" }); const s = f[0].getImage(); return new Promise((r) => { const c = []; s.on("data", d => c.push(d)); s.on("end", () => r(Buffer.concat(c))); }); }
async function hashImage(fp) { const buf = await gifToPngBuffer(fp); const input = buf || fp; const { data } = await sharp(input).resize(8,8,{fit:"fill"}).grayscale().raw().toBuffer({resolveWithObject:true}); let sum = 0; for (let i=0;i<64;i++) sum+=data[i]; const avg=sum/64; let bits=0n; for (let i=0;i<64;i++) if (data[i]>avg) bits |= 1n << BigInt(i); return { hex: bits.toString(16).padStart(16,"0"), bigint: toSigned64(bits) }; }
async function nearDup(ph, t=10) { const r = await prisma.$queryRaw`SELECT id, hash, BIT_COUNT(("mediaHash" # ${ph})::bit(64)) AS d FROM (SELECT id, hash, "mediaHash" FROM "ReactionGif" WHERE "mediaHash" IS NOT NULL UNION ALL SELECT id, hash, "mediaHash" FROM "SubmittedReactonGif" WHERE "mediaHash" IS NOT NULL) c WHERE BIT_COUNT(("mediaHash" # ${ph})::bit(64)) <= ${t} ORDER BY d LIMIT 1`; return r?.[0] ? { id: r[0].id, hash: r[0].hash } : null; }
async function download(url, dest) { const w = fs.createWriteStream(dest); const r = await axios({method:"get",url,responseType:"stream",timeout:30000}); await new Promise((res,rej) => { w.on("finish",res); w.on("error",rej); r.data.pipe(w); }); }

async function main() {
  fs.mkdirSync(GIF_DIR, { recursive: true });
  console.log(`=== Tenor Anime Fill [${PER_ACTION} per action, ${ACTIONS.length} actions] ===\n`);

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
