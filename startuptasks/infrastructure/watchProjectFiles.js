const fs = require("fs");
const path = require("path");
const { ActivityType } = require("discord.js");
const { getLogger } = require("../../lib/logger");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const IGNORE_DIRS = ["node_modules", ".git", ".history", "generated"];
const TRACKED_EXTS = [".js", ".json", ".env"];
const DEBOUNCE_MS = 4000;
const INACTIVITY_MS = 2 * 60 * 1000;

const LARGE_KEYS = ["cassie-coding", "cassie-working", "cassie-hacking"];
const SMALL_KEYS = {
	".js": "file-js",
	".json": "file-json",
	".env": "file-env",
};

module.exports = {
	name: "watchProjectFiles",
	description: "Watches project files and updates bot presence when coding",
	needsReadyClient: true,

	async execute(client) {
		const log = getLogger("FileWatcher");

		let updateTimer = null;
		let inactivityTimer = null;
		let pendingFile = null;

		function clearTimers() {
			if (updateTimer) {
				clearTimeout(updateTimer);
				updateTimer = null;
			}
			if (inactivityTimer) {
				clearTimeout(inactivityTimer);
				inactivityTimer = null;
			}
		}

		function revertPresence() {
			clearTimers();
			pendingFile = null;
			client.user.setPresence({ activities: [], status: "online" });
			log.info("Presence reverted to default (inactivity)");
		}

		function scheduleUpdate(filename) {
			pendingFile = filename;

			// Reset inactivity timer
			if (inactivityTimer) clearTimeout(inactivityTimer);
			inactivityTimer = setTimeout(revertPresence, INACTIVITY_MS);

			// Debounce: batch rapid saves into one update
			if (!updateTimer) {
				updateTimer = setTimeout(() => {
					updateTimer = null;
					const file = pendingFile;
					pendingFile = null;

					const ext = path.extname(file);
					const largeImg =
						LARGE_KEYS[
							Math.floor(Math.random() * LARGE_KEYS.length)
						];

					client.user.setPresence({
						activities: [
							{
								name: "My owner is playing with me",
								type: ActivityType.Playing,
								details: `Editing: ${file}`,
								state: "My owner is playing with me",
								timestamps: { start: Date.now() },
								assets: {
									largeImage: largeImg,
									largeText: "Cassie Bot",
									smallImage:
										SMALL_KEYS[ext] || "file-generic",
									smallText: ext,
								},
							},
						],
						status: "online",
					});

					log.info(`Presence updated: ${file} — ${3}`);
				}, DEBOUNCE_MS);
			}
		}

		try {
			fs.watch(
				PROJECT_ROOT,
				{ recursive: true },
				(eventType, filename) => {
					if (!filename || eventType !== "change") return;

					const relative = filename.replace(/\\/g, "/");

					// Skip ignored directories
					for (const dir of IGNORE_DIRS) {
						if (
							relative.startsWith(dir + "/") ||
							relative.includes("/" + dir + "/")
						) {
							return;
						}
					}                            
					// Only track relevant file types
					if (!TRACKED_EXTS.includes(path.extname(relative))) return;

					scheduleUpdate(relative);
				},
			);

			log.info(`Watching ${PROJECT_ROOT} for file changes...`);
		} catch (err) {
			log.error("Failed to start file watcher:", err.message);
		}
	},
};
