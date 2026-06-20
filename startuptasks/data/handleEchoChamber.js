const { WebhookClient, AttachmentBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const db = require("../../db");
const { getLogger } = require("../../lib/logger");

module.exports = {
	name: "echochamber",
	description: "Deliver due echo chamber messages via webhook",
	reloadAble: true,

	/** state */
	_executing: false,
	_running: false,
	_wake: null,

	/**
	 * Start the delivery loop. Called once from startup tasks.
	 */
	async execute(client) {
		if (this._executing) return;
		this._executing = true;

		const log = getLogger("echo cham chamber");
		this._client = client;
		this._running = true;

		log.info("🔁 loop start");

		while (this._running) {
			try {
				const channels = await db.prisma.echoChannel.findMany({
					include: {
						messages: {
							where: {
								deliveredAt: null,
								deliverAt: { lte: new Date() },
							},
						},
					},
				});

				let sent = 0;
				for (const ch of channels) {
					if (!ch.messages.length) continue;

				const guild = await client.guilds.fetch(ch.guildId).catch(() => null);
				if (!guild) {
					// Bot was kicked or guild deleted — mark all undelivered as delivered so the loop stops spinning every 1s
					await db.prisma.echoMessage.updateMany({
						where: { channelId: ch.channelId, deliveredAt: null },
						data: { deliveredAt: new Date() },
					});
					log.warn(`guild ${ch.guildId} not found, marked ${ch.messages.length} messages as delivered`);
					continue;
				}

					let wh = new WebhookClient({ token: ch.webhookToken, id: ch.webhookId });

					for (const msg of ch.messages) {
						// Double-check before send — another loop iteration might have gotten it
						const row = await db.prisma.echoMessage.findUnique({ where: { id: msg.id } });
						if (row?.deliveredAt) {
							log.warn(`${msg.id} already delivered, skipping`);
							continue;
						}

						if (!msg.content && !msg.attachments?.length && !msg.embeds?.length && !msg.poll) {
							await db.prisma.echoMessage.update({ where: { id: msg.id }, data: { deliveredAt: new Date() } });
							continue;
						}

						try {
							const member = await guild.members.fetch(msg.authorId).catch(() => null);
							const opts = {
								content: msg.content || undefined,
								allowedMentions: { parse: [] },
							};
							if (member) {
								opts.username = member.displayName;
								opts.avatarURL = member.displayAvatarURL();
							}
							if (msg.originalMessageId) opts.message_reference = { message_id: msg.originalMessageId };

							if (msg.attachments?.length) {
								const ok = msg.attachments.filter(a => { try { fs.accessSync(a.path); return true; } catch { return false; } });
								if (ok.length) opts.files = ok.map(a => new AttachmentBuilder(a.path, { name: a.filename }));
							}
							if (msg.poll) opts.poll = msg.poll;
							if (msg.embeds?.length) opts.embeds = msg.embeds;

							if (!opts.content && !opts.files?.length && !opts.embeds?.length && !opts.poll) {
								await db.prisma.echoMessage.update({ where: { id: msg.id }, data: { deliveredAt: new Date() } });
								continue;
							}

							await wh.send(opts);
							await db.prisma.echoMessage.update({ where: { id: msg.id }, data: { deliveredAt: new Date() } });
							sent++;

							if (msg.attachments?.length) {
								fs.rmSync(path.dirname(msg.attachments[0].path), { recursive: true, force: true });
							}
						} catch (error) {
							if (error.code === 10015) {
								log.warn("webhook deleted, recreating...");
								try {
									const c = await guild.channels.fetch(ch.channelId);
									if (!c?.isTextBased()) continue;
									const nw = await c.createWebhook({ name: "Echo Chamber" });
									await db.prisma.echoChannel.update({ where: { id: ch.id }, data: { webhookId: nw.id, webhookToken: nw.token } });
									wh = nw;

									const member = await guild.members.fetch(msg.authorId).catch(() => null);
									const ropts = { content: msg.content || undefined, allowedMentions: { parse: [] } };
									if (member) { ropts.username = member.displayName; ropts.avatarURL = member.displayAvatarURL(); }
									if (msg.originalMessageId) ropts.message_reference = { message_id: msg.originalMessageId };
									if (msg.attachments?.length) {
										const ok = msg.attachments.filter(a => { try { fs.accessSync(a.path); return true; } catch { return false; } });
										if (ok.length) ropts.files = ok.map(a => new AttachmentBuilder(a.path, { name: a.filename }));
									}
									if (msg.poll) ropts.poll = msg.poll;
									if (msg.embeds?.length) ropts.embeds = msg.embeds;
									await wh.send(ropts);
									await db.prisma.echoMessage.update({ where: { id: msg.id }, data: { deliveredAt: new Date() } });
									sent++;
									if (msg.attachments?.length) fs.rmSync(path.dirname(msg.attachments[0].path), { recursive: true, force: true });
								} catch (err2) {
									log.warn(`${msg.id} retry failed: ${err2.message}`);
								}
							} else {
								log.warn(`${msg.id} send failed (${error.code}): ${error.message}`);
							}
						}
					}
				}
				if (sent) log.info(`📨 ${sent} delivered`);

				// Sleep until the next undelivered message is due
				const next = await db.prisma.echoMessage.findFirst({
					where: { deliveredAt: null },
					orderBy: { deliverAt: "asc" },
				});

				if (next) {
					const ms = Math.max(1000, new Date(next.deliverAt) - new Date());
					log.info(`⏰ next in ${Math.round(ms / 1000)}s`);
					await this._sleep(ms);
				} else {
					log.info("⏰ idle — waiting for recheck() to wake");
					// Safety net only: recheck() wakes it instantly when a message arrives
					await this._sleep(3_600_000);
				}
			} catch (err) {
				log.error(`loop error: ${err.message}`);
				await this._sleep(5000);
			}
		}

		log.info("🔚 loop end");
		this._executing = false;
	},

	/** Sleep for ms, but can be woken early by recheck() */
	_sleep(ms) {
		if (this._sleepTimer) clearTimeout(this._sleepTimer);
		return new Promise(resolve => {
			this._wake = resolve;
			this._sleepTimer = setTimeout(() => {
				// Don't null _wake if a newer sleep already replaced it
				if (this._wake === resolve) this._wake = null;
				resolve();
			}, ms);
		});
	},

	/** Wake the loop early — called after a new message is queued */
	recheck() {
		if (this._wake) {
			this._wake();
			this._wake = null;
		}
	},

	/** Stop the loop cleanly */
	cleanUp() {
		this._running = false;
		if (this._wake) {
			this._wake();
			this._wake = null;
		}
		if (this._sleepTimer) {
			clearTimeout(this._sleepTimer);
			this._sleepTimer = null;
		}
	},
};
