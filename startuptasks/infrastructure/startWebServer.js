const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
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

	app: null,
	server: null,

	async execute(client) {
		const log = getLogger("WebServer");

		const app = express();
		this.app = app;

		// REQUIRED for funnel / HTTPS cookies
		app.set("trust proxy", 1);

		app.use(express.json());
		app.use(express.urlencoded({ extended: true }));

		// CORS (safe for OAuth + dashboard)
		app.use(
			cors({
				origin: process.env.BASE_URL,
				credentials: true,
			}),
		);

		// -----------------------------
		// SESSION MIDDLEWARE (Prisma)
		// -----------------------------
		const sessionMiddleware = require("../../dashboard/session");
		app.use(sessionMiddleware);

		// -----------------------------
		// ROUTER AUTH MIDDLEWARE
		// -----------------------------
		function requireAuth(req, res, next) {
			if (!req.session.user) return res.redirect("/login");
			next();
		}

		// Protect dashboard only
		app.use("/dashboard", requireAuth);
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
		app.get("/", (req, res) => {
			res.send("bot online");
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
			log.info(`[404] ${req.method} ${req.path}`);
			res.status(404).json({
				ok: false,
				error: "not found",
			});
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

	cleanup() {
		if (this.server) this.server.close();
		this.server = null;
		this.app = null;
	},
};
