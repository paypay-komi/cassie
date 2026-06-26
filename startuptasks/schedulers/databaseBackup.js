const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "databaseBackup",
	description: "Daily pg_dump backup with 7-day retention",
	reloadAble: true,
	timer: null,
	prerequisites: [],
	async execute() {
		const log = getLogger("DBBackup");
		const backupDir = path.resolve(__dirname, "../../backups");
		const retentionDays = 7;

		const runBackup = () => {
			try {
				if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

				const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
				const file = path.join(backupDir, `cassiebotdb-${date}.sql`);

				const pgDump = `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"`;
				const cmd = `${pgDump} --host=localhost --port=5432 --username=postgres --dbname=cassiebotdb --file="${file}" --format=plain --no-owner --no-acl`;

				execSync(cmd, { env: { ...process.env, PGPASSWORD: "42810" }, timeout: 120000 });

				log.info(`Backup created: ${file}`);

				const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
				for (const f of fs.readdirSync(backupDir)) {
					const fp = path.join(backupDir, f);
					if (f.endsWith(".sql") && fs.statSync(fp).mtimeMs < cutoff) {
						fs.unlinkSync(fp);
						log.info(`Cleaned old backup: ${f}`);
					}
				}
			} catch (err) {
				log.error(`Backup failed: ${err.message}`);
			}

			const next = new Date();
			next.setHours(next.getHours() + 24);
			next.setMinutes(0, 0, 0);
			this.timer = setTimeout(runBackup, next.getTime() - Date.now());
		};

		const next = new Date();
		next.setHours(next.getHours() + 1, 0, 0, 0);
		setTimeout(() => {
			runBackup();
		}, next.getTime() - Date.now());

		log.info("DB backup scheduler started (runs at 3:00 AM daily, 7-day retention)");
	},
	cleanUp() {
		if (this.timer) clearTimeout(this.timer);
	},
	recheck() {
		this.cleanUp();
		this.execute();
	},
};
