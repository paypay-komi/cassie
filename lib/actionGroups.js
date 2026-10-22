const fs = require("fs");
const path = require("path");

const CHUNK_SIZE = 25;
const ACTIONS_DIR = path.join(__dirname, "..", "commands", "text", "actions");
const EXCLUDE = new Set(["router.js", "submitGif.js"]);

const ALL_ACTIONS = fs
	.readdirSync(ACTIONS_DIR)
	.filter((f) => f.endsWith(".js") && !EXCLUDE.has(f))
	.map((f) => f.replace(/\.js$/, ""));

const GROUPS = [];
for (let i = 0; i < ALL_ACTIONS.length; i += CHUNK_SIZE) {
	GROUPS.push({
		name: `group${GROUPS.length + 1}`,
		actions: ALL_ACTIONS.slice(i, i + CHUNK_SIZE),
	});
}

module.exports = { ALL_ACTIONS, GROUPS };
