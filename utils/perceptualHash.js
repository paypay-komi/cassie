const imghash = require("imghash");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const FRAME_SIZE = 32;

async function hashImage(filePath) {
  return await imghash.hash(filePath, 16, "hex");
}

async function hashVideo(filePath) {
  const tmp = path.join(os.tmpdir(), `phash_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
  try {
    await new Promise((res, rej) =>
      execFile("ffmpeg", [
        "-i", filePath,
        "-vframes", "1",
        "-vf", `scale=${FRAME_SIZE}:${FRAME_SIZE}`,
        "-y", tmp,
      ], { timeout: 15000 }, (err) => err ? rej(err) : res())
    );
    const hash = await imghash.hash(tmp, 16, "hex");
    return hash;
  } finally {
    fs.unlink(tmp, () => {});
  }
}

function isVideo(path) {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(path);
}

function isGif(path) {
  return /\.gif$/i.test(path);
}

async function hashMedia(filePath) {
  if (isVideo(filePath)) return await hashVideo(filePath);
  return await hashImage(filePath);
}

function hammingDistance(a, b) {
  if (a.length !== b.length) return -1;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    d += (xor.toString(2).match(/1/g) || []).length;
  }
  return d;
}

function findDuplicates(hashes, currentHash, threshold = 10) {
  return hashes.filter(h => h.mediaHash && hammingDistance(h.mediaHash, currentHash) <= threshold);
}

module.exports = { hashMedia, hashImage, hashVideo, hammingDistance, findDuplicates };
