const fs = require("fs");
const path = require("path");

// Persists a pending "restart confirmation" across the restart.
// The restart command writes here before killing the process; a startup
// task reads it after the bot comes back up, sends the confirmation,
// then clears it.
const PENDING_FILE = path.join(__dirname, "..", "restart-pending.json");
const MAX_AGE_MS = 10 * 60 * 1000;

function savePendingEntry(entry) {
	try {
		fs.writeFileSync(PENDING_FILE, JSON.stringify(entry));
		return true;
	} catch (err) {
		return false;
	}
}

function readPendingEntry() {
	try {
		if (!fs.existsSync(PENDING_FILE)) return null;
		const raw = fs.readFileSync(PENDING_FILE, "utf8");
		const entry = JSON.parse(raw);
		if (!entry || !entry.channelId) return null;
		if (entry.requestedAt && Date.now() - entry.requestedAt > MAX_AGE_MS) {
			clearPendingEntry();
			return null;
		}
		return entry;
	} catch {
		return null;
	}
}

function clearPendingEntry() {
	try {
		if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
		return true;
	} catch {
		return false;
	}
}

module.exports = { savePendingEntry, readPendingEntry, clearPendingEntry };