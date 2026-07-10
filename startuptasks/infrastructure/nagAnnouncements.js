const { getLogger } = require("../../lib/logger");
const {
	findAnnouncementChannel,
} = require("../../lib/findAnnouncementChannel");

const NAG_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // once per week per guild
const MIN_DELAY_MS = 1000; // never schedule less than 1s out
const BATCH_DELAY_MS = 500; // stagger between guilds within a batch
const STARTUP_DELAY_MS = 30_000;

module.exports = {
	name: "nagAnnouncements",
	shard0Only: true,
	needsReadyClient: true,
	reloadAble: true,
	priority: 20,
	timer: null,
	startupTimer: null,
	running: false, // guards against overlapping runTask cycles
	client: null, // remembered so recheck() can restart cleanly

	async execute(client) {
		const log = getLogger("NagAnnouncements");

		// Guard against execute() being called again (reload, duplicate ready
		// event, etc.) while a previous instance is still active.
		this.cleanUp();
		this.client = client;

		// ── Backfill rows for guilds missing a GuildAnnouncement row ──
		async function backfillExistingGuilds() {
			try {
				const allGuildIds = client.guilds.cache.map((g) => g.id);
				if (allGuildIds.length === 0) return;

				const existingRows =
					await client.db.prisma.guildAnnouncement.findMany({
						where: { guildId: { in: allGuildIds } },
						select: { guildId: true },
					});
				const existingIds = new Set(existingRows.map((r) => r.guildId));
				const missingIds = allGuildIds.filter(
					(id) => !existingIds.has(id),
				);

				if (missingIds.length === 0) return;

				// Ensure GuildSettings rows exist first (FK constraint)
				await client.db.prisma.guildSettings.createMany({
					data: missingIds.map((guildId) => ({ guildId })),
					skipDuplicates: true,
				});

				await client.db.prisma.guildAnnouncement.createMany({
					data: missingIds.map((guildId) => ({ guildId })),
					skipDuplicates: true,
				});
				log.info(
					`Backfilled GuildAnnouncement rows for ${missingIds.length} existing guilds`,
				);
			} catch (err) {
				log.error(`Backfill failed: ${err.message}`);
			}
		}

		// ── Nag a single guild. Returns the guild on success, false otherwise ──
		async function nagGuild(row) {
			const guild = client.guilds.cache.get(row.guildId);
			if (!guild) return false;

			const channel = findAnnouncementChannel(guild);
			if (!channel) return false;

			if (!channel.permissionsFor(guild.members.me).has("SendMessages")) {
				return false;
			}

			const prefix = await client.db.guild.getPrefix(row.guildId);

			try {
				await channel.send({
					content:
						`👋 **${client.user.username} needs an announcement channel!**\n\n` +
						`I send important updates here — run \`${prefix}subscribe #channel\` to pick where they go.\n` +
						`Don't want these messages? Run \`${prefix}unsubscribe\` and I'll stop asking.`,
					allowedMentions: { parse: [] },
				});
				return guild;
			} catch (err) {
				log.warn(
					`Nag failed for ${row.guildId} (${guild.name}): ${err.message}`,
				);
				return false;
			}
		}

		// ── Find & nag all due guilds, then schedule next check ──
		const runTask = async () => {
			if (this.running) {
				log.warn(
					"runTask already in progress, skipping overlapping run",
				);
				return;
			}
			this.running = true;

			try {
				const cutoff = new Date(Date.now() - NAG_INTERVAL_MS);
				const due = await client.db.announcements.getNagDue(cutoff);

				const naggedGuilds = [];

				for (const row of due) {
					const nagged = await nagGuild(row);
					if (nagged) {
						// Awaited before moving on so a subsequent cycle
						// (or a restart) can't re-select this guild.
						await client.db.announcements.markNagged(row.guildId);
						naggedGuilds.push(nagged);
					}
					await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
				}

				if (naggedGuilds.length > 0) {
					const names = naggedGuilds
						.map((g) => `${g.name} (${g.id})`)
						.join(", ");
					log.info(
						`Nagged ${naggedGuilds.length} guild(s): ${names}`,
					);
				}
			} catch (err) {
				log.error("Nag cycle error:", err);
			} finally {
				this.running = false;
			}

			scheduleNext();
		};

		// ── Schedule next check at the exact time the next guild needs nagging ──
		const scheduleNext = () => {
			if (this.timer) {
				clearTimeout(this.timer);
				this.timer = null;
			}

			client.db.announcements
				.getNextNagDue()
				.then((next) => {
					let delay;

					if (next) {
						if (next.lastNagged) {
							delay =
								new Date(next.lastNagged).getTime() +
								NAG_INTERVAL_MS -
								Date.now();
						} else {
							// Never nagged before — due immediately, not in
							// a full week.
							delay = MIN_DELAY_MS;
						}
					}

					if (!delay || delay < MIN_DELAY_MS) {
						delay = Math.max(
							delay ?? NAG_INTERVAL_MS,
							MIN_DELAY_MS,
						);
					}

					this.timer = setTimeout(runTask, delay);
					log.info(
						`Next announcement nag in ${Math.round(delay / 1000 / 60)}m`,
					);
				})
				.catch((err) => {
					log.error("scheduleNext error:", err);
					this.timer = setTimeout(runTask, NAG_INTERVAL_MS);
				});
		};

		// ── Startup: backfill then kick off first cycle ──
		this.startupTimer = setTimeout(async () => {
			this.startupTimer = null;
			await backfillExistingGuilds();
			runTask();
		}, STARTUP_DELAY_MS);

		log.info("✅ Announcement nag system started (smart scheduling)");
	},

	cleanUp() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		if (this.startupTimer) {
			clearTimeout(this.startupTimer);
			this.startupTimer = null;
		}
		this.running = false;
	},

	recheck() {
		const client = this.client;
		this.cleanUp();
		if (!client) {
			getLogger("NagAnnouncements").warn(
				"recheck() called before execute() has set a client; ignoring",
			);
			return;
		}
		this.execute(client);
	},
};
