const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const TUNNEL_STATE_FILE = path.join(__dirname, "..", ".tunnel-state.json");
const PORTS = [3000, 3001, 3002, 3003];

function findDevTunnel() {
	try {
		const out = execSync(
			"where.exe devtunnel 2>nul || which devtunnel 2>/dev/null",
			{ encoding: "utf8", stdio: "pipe" },
		);
		const p = out.trim().split("\n")[0]?.trim();
		if (p) return p;
	} catch {}

	const searchPaths = [
		`${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages`,
		`${process.env.PROGRAMFILES}\\Microsoft\\WinGet\\Packages`,
	];
	for (const base of searchPaths) {
		try {
			const files = execSync(`dir /s /b "${base}\\devtunnel.exe" 2>nul`, {
				encoding: "utf8",
			});
			const match = files.trim().split("\n")[0]?.trim();
			if (match) return match;
		} catch {}
	}
	return null;
}

function loadAllTunnelState() {
	try {
		if (fs.existsSync(TUNNEL_STATE_FILE)) {
			return JSON.parse(fs.readFileSync(TUNNEL_STATE_FILE, "utf8"));
		}
	} catch (err) {
		console.error("Failed to load tunnel state:", err.message);
	}
	return {};
}

function saveAllTunnelState(state) {
	fs.writeFileSync(TUNNEL_STATE_FILE, JSON.stringify(state, null, 2));
}

function ensureTunnelForPort(devtunnelPath, port, allState) {
	const key = String(port);
	const existing = allState[key];

	if (existing?.tunnelId) {
		try {
			execSync(`"${devtunnelPath}" show ${existing.tunnelId}`, {
				stdio: "ignore",
			});
			console.log(
				`[Tunnel] Port ${port} reusing tunnel: ${existing.tunnelId}`,
			);
			// Ensure the port is added (in case the tunnel was
			// created without ports on a previous run)
			try {
				execSync(
					`"${devtunnelPath}" port create ${existing.tunnelId} -p ${port}`,
					{ stdio: "pipe", encoding: "utf8", timeout: 10000 },
				);
				console.log(`[Tunnel] Port ${port} added to tunnel`);
			} catch (err) {
				const msg = err.stderr?.toString() || err.message || "";
				if (!msg.includes("already exists")) {
					console.warn(`[Tunnel] Port ${port} add warn: ${msg.slice(0, 200)}`);
				}
			}
			return existing;
		} catch {
			console.log(
				`[Tunnel] Port ${port} saved tunnel gone, creating new one...`,
			);
		}
	}

	console.log(`[Tunnel] Port ${port} creating new tunnel...`);
	const createOut = execSync(`"${devtunnelPath}" create`, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	const tunnelId = createOut.match(/Tunnel ID\s*:\s*(\S+)/)?.[1]?.trim();
	if (!tunnelId) {
		throw new Error(`Port ${port} — failed to parse tunnel ID from: ${createOut}`);
	}

	console.log(`[Tunnel] Port ${port} created tunnel: ${tunnelId}`);

	// Add the single port to this tunnel
	try {
		execSync(
				`"${devtunnelPath}" port create ${tunnelId} -p ${port}`,
				{ stdio: "pipe", encoding: "utf8", timeout: 10000 },
		);
		console.log(`[Tunnel] Port ${port} added to tunnel`);
	} catch (err) {
		const msg = err.stderr?.toString() || err.message || "";
		if (!msg.includes("already exists")) {
			console.warn(`[Tunnel] Port ${port} add warn: ${msg.slice(0, 200)}`);
		}
	}

	const cluster = tunnelId.split(".").pop() || "usw2";
	const state = { tunnelId, cluster };
	allState[key] = state;
	saveAllTunnelState(allState);
	return state;
}

module.exports = {
	name: "startDevTunnels",
	description:
		"Creates and hosts a dev tunnel per webhook port via Microsoft devtunnel CLI",
	reloadAble: true,

	processes: [],

	execute(client) {
		this.cleanup();

		const devtunnelPath = findDevTunnel();
		if (!devtunnelPath) {
			console.warn(
				"[Tunnel] devtunnel CLI not found. Install with: winget install Microsoft.devtunnel && devtunnel user login",
			);
			return;
		}

		console.log(`[Tunnel] Using devtunnel at: ${devtunnelPath}`);

		const allState = loadAllTunnelState();
		client.devTunnelUrls = {};

		for (const port of PORTS) {
			let state;
			try {
				state = ensureTunnelForPort(devtunnelPath, port, allState);
			} catch (err) {
				console.error(`[Tunnel] Port ${port} setup failed:`, err.message);
				continue;
			}

			const hostArgs = ["host", state.tunnelId, "--allow-anonymous"];

			console.log(`[Tunnel] Port ${port} spawning: ${hostArgs.join(" ")}`);

			const proc = spawn(devtunnelPath, hostArgs, {
				stdio: ["ignore", "pipe", "pipe"],
			});

			this.processes.push(proc);

			proc.stdout.on("data", (data) => {
				const output = data.toString();
				console.log(`[devtunnel:${port}] ${output.trim()}`);

				// "Port 3000: https://abc-3000.usw2.devtunnels.ms/"
				const match = output.match(
					new RegExp(
						`Port ${port}:\\s+(https://\\S+\\.devtunnels\\.ms/?)`,
					),
				);
				if (match) {
					client.devTunnelUrls[port] = match[1].replace(/\/$/, "");
					console.log(
						`[Tunnel] Port ${port} → ${client.devTunnelUrls[port]}`,
					);
				}
			});

			proc.stderr.on("data", (data) => {
				console.error(`[devtunnel:${port} ERR] ${data.toString().trim()}`);
			});

			proc.on("exit", (code) => {
				console.log(`[Tunnel] Port ${port} process exited with code ${code}`);
			});
		}
	},

	cleanup() {
		for (const proc of this.processes) {
			try {
				proc.kill();
			} catch {}
		}
		this.processes = [];
	},
};
