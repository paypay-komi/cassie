const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
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

	app: null,
	server: null,

	async execute(client) {
		const log = getLogger("WebServer");
		const app = express();
		this.app = app;
		app.use(cors());
		app.get("/", (req, res) => {
			res.send("bot online");
		});

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

		// 404 handler
		app.use((req, res) => {
			log.info(`[404] ${req.method} ${req.path}`);
			res.status(404).json({
				ok: false,
				error: "not found",
			});
		});

		this.server = app.listen(3000, () => {
			log.info("webserver running on 3000");
		});

		client.app = app;
	},

	cleanup() {
		if (this.server) this.server.close();
		this.server = null;
		this.app = null;
	},
};
