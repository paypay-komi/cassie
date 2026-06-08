/**
 * Parses schema.prisma for `// @userid` annotations and builds
 * a map of { modelName: { field: fieldName }[] } that mydata uses
 * to query all user data without hardcoding table names.
 *
 * Annotate any user-ID field in schema.prisma with:
 *   // @userid
 *   userId String
 *
 * Supports multiple @userid fields per model — each gets queried.
 */
const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

let cachedMap = null;

/**
 * @returns {Record<string, {field: string}[]>}
 */
function parseSchema() {
	if (cachedMap) return cachedMap;

	const raw = fs.readFileSync(SCHEMA_PATH, "utf-8");
	const lines = raw.split("\n");

	const map = {};
	let currentModel = null;
	let prevLineWasUserId = false;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		// Detect model block start: `model Name {`
		const modelMatch = line.match(/^model\s+(\w+)\s*\{$/);
		if (modelMatch) {
			currentModel = modelMatch[1];
			prevLineWasUserId = false;
			continue;
		}

		// Detect closing brace
		if (line === "}" && currentModel) {
			currentModel = null;
			prevLineWasUserId = false;
			continue;
		}

		if (!currentModel) {
			prevLineWasUserId = false;
			continue;
		}

		// Check for @userid annotation (supports variations: // @userid, //@userid)
		if (/^\/\/\s*@userid/.test(line)) {
			prevLineWasUserId = true;
			continue;
		}

		// If previous line had @userid, this should be a field definition
		if (prevLineWasUserId) {
			const fieldMatch = line.match(/^(\w+)\s/);
			if (fieldMatch) {
				const fieldName = fieldMatch[1];
				if (!map[currentModel]) map[currentModel] = [];
				map[currentModel].push({ field: fieldName });
			}
			prevLineWasUserId = false;
		}
	}

	cachedMap = map;
	return map;
}

/**
 * Resets the cache (useful for hot-reload / recheck scenarios).
 */
function resetCache() {
	cachedMap = null;
}

module.exports = { parseSchema, resetCache };
