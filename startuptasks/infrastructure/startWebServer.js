const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const { getLogger } = require("../../lib/logger");

function walk(dir) {
	const files = fs.readdirSync(dir);
	let out = [];

	for (const file of files) {
		const full = path.join(dir, file);

		if (fs.statSync(full).isDirectory()) {
			out = out.concat(walk(full));
		} else {
			out.push(full);
		}
	}

	return out;
}

module.exports = {
	name: "webserver",
	shard0Only: true,
	reloadAble: true,

	app: null,
	server: null,

	async execute(client) {
		const log = getLogger("WebServer");

		const app = express();
		this.app = app;

		// REQUIRED for funnel / HTTPS cookies
		app.set("trust proxy", 1);

		// Capture raw body bytes on every request before any parsing.
		// Webhook HMAC verification needs the exact raw string, not the
		// re-serialized object. Each parser's verify callback fires when it
		// actually reads the body; subsequent parsers skip because req._body
		// is already set.
		app.use(
			express.json({
				verify: (req, res, buf, enc) => {
					req.rawBody = buf.toString(enc || "utf8");
				},
			}),
		);
		app.use(
			express.urlencoded({
				extended: true,
				verify: (req, res, buf, enc) => {
					if (!req.rawBody) req.rawBody = buf.toString(enc || "utf8");
				},
			}),
		);
		// Catch-all for non-JSON, non-form text bodies (JWT webhooks, etc.)
		app.use(
			express.text({
				type: "*/*",
				verify: (req, res, buf, enc) => {
					if (!req.rawBody) req.rawBody = buf.toString(enc || "utf8");
				},
			}),
		);

		// CORS (safe for OAuth + dashboard)
		app.use(
			cors({
				origin: process.env.BASE_URL,
				credentials: true,
			}),
		);

		// -----------------------------
		// RATE LIMITING
		// -----------------------------
		const generalLimiter = rateLimit({
			windowMs: 60 * 1000,
			max: 1000,
			standardHeaders: true,
			legacyHeaders: false,
			message: { ok: false, error: "Too many requests, slow down" },
		});
		app.use(generalLimiter);

		const apiLimiter = rateLimit({
			windowMs: 60 * 1000,
			max: 500,
			standardHeaders: true,
			legacyHeaders: false,
			message: { ok: false, error: "Too many requests, slow down" },
		});

		app.use("/api/", apiLimiter);
		app.use(
			"/webhook/",
			rateLimit({
				windowMs: 60 * 1000,
				max: 200,
				standardHeaders: true,
				legacyHeaders: false,
				message: { ok: false, error: "Too many requests" },
			}),
		);

		// -----------------------------
		// SESSION MIDDLEWARE (Prisma)
		// -----------------------------
		const sessionMiddleware = require("../../dashboard/session");
		app.use(sessionMiddleware);

		console.log(`${process.env.BASE_URL}/auth/discord/callback`);
		// CALLBACK → exchange code → session

		// logout (optional but useful)
		app.get("/logout", (req, res) => {
			req.session.destroy(() => {
				res.redirect("/");
			});
		});

		// -----------------------------
		// BASIC ROUTES
		// -----------------------------
		app.get("/", async (req, res) => {
			const guildCount = client.guilds?.cache?.size ?? "?";
			const memberCount =
				client.guilds?.cache?.reduce(
					(sum, g) => sum + (g.memberCount ?? 0),
					0,
				) ?? "?";
			let cmdCount = 0;
			let userCount = 0;
			try {
				cmdCount = await client.db.stats.getTotalExecutions();
			} catch {}
			try {
				userCount = await client.db.stats.getTotalUsers();
			} catch {}
			const html = fs
				.readFileSync(
					path.join(process.cwd(), "views", "landing.html"),
					"utf8",
				)
				.replace("{{guildCount}}", guildCount.toString())
				.replace("{{cmdCount}}", cmdCount.toString())
				.replace("{{userCount}}", userCount.toString())
				.replace("{{memberCount}}", memberCount.toString());
			res.send(html);
		});

		// -----------------------------
		// YOUR ROUTE LOADER (UNCHANGED)
		// -----------------------------
		const routesDir = path.join(process.cwd(), "routes");
		const files = walk(routesDir).filter((f) => f.endsWith(".js"));

		const baseUrl =
			process.env.BASE_URL ||
			`http://localhost:${process.env.PORT || 3000}`;

		for (const file of files) {
			delete require.cache[require.resolve(file)];

			const route = require(file);
			if (!route?.path || !route?.handler) continue;

			const method = (route.method || "post").toLowerCase();
			const middleware = route.middleware || [];

			app[method](route.path, ...middleware, route.handler);

			const fullUrl = new URL(route.path, baseUrl).href;

			log.info(`[route] ${method.toUpperCase()} ${fullUrl}`);
		}

		// -----------------------------
		// 404 HANDLER
		// -----------------------------
		app.use((req, res) => {
			const isApi =
				req.path.startsWith("/api/") ||
				req.path.startsWith("/webhook/");
			if (isApi) {
				res.status(404).json({ ok: false, error: "not found" });
			} else {
				res.status(404).sendFile(
					path.join(process.cwd(), "views", "404.html"),
				);
			}
		});

		// -----------------------------
		// START SERVER
		// -----------------------------
		this.server = app.listen(3000, () => {
			log.info("webserver running on 3000");
		});

		// Expose client to route handlers via app.locals
		app.locals.client = client;
		client.app = app;
	},

	async cleanup() {
		if (this.server) {
			await new Promise((resolve) => this.server.close(resolve));
		}
		this.server = null;
		this.app = null;
	},
};
