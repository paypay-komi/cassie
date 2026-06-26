const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const GIF_DIR = "L:/reactiongifs";
const VALID_EXTS = new Set(["gif","png","jpg","jpeg","webp","mp4","webm","mov","avi","mkv","flv","wmv","m4v"]);

const files = fs.readdirSync(GIF_DIR).filter(f => VALID_EXTS.has(path.extname(f).toLowerCase().replace(".","")));
console.log("Total files on disk:", files.length);

const prisma = new PrismaClient();
prisma.reactionGif.count().then(c => {
  console.log("Already categorized:", c);
  console.log("Remaining:", files.length - c);
  prisma.$disconnect();
});
