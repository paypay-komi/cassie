const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");

const TUNNEL_STATE_FILE = path.join(__dirname, "..", ".tunnel-state.json");
const PORTS = [3000, 3001];

function findDevTunnel() {
	// Try PATH first
	try {
		const out = execSync("where.exe devtunnel 2>nul || which devtunnel 2>/dev/null", {
			encoding: "utf8",
			stdio: "pipe",
		});
		const path = out.trim().split("\n")[0]?.trim();
		if (path) return path;
	} catch {}

	// Search common winget install locations
	const searchPaths = [
		`${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages`,
		`${process.env.PROGRAMFILES}\\Microsoft\\WinGet\\Packages`,
	];
	for (const base of searchPaths) {
		try {
			const files = execSync(
				`dir /s /b "${base}\\devtunnel.exe" 2>nul`,
				{ encoding: "utf8" },
			);
			const match = files.trim().split("\n")[0]?.trim();
			if (match) return match;
		} catch {}
	}

	return null;
}

function loadTunnelState() {
	try {
		if (fs.existsSync(TUNNEL_STATE_FILE)) {
			return JSON.parse(fs.readFileSync(TUNNEL_STATE_FILE, "utf8"));
		}
	} catch (err) {
		console.error("Failed to load tunnel state:", err.message);
	}
	return null;
}

function saveTunnelState(state) {
	fs.writeFileSync(TUNNEL_STATE_FILE, JSON.stringify(state, null, 2));
}

function getExe(cmd) {
	return (...args) => execSync(`"${cmd}" ${args.join(" ")}`, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function ensureTunnel(devtunnelPath) {
	const run = getExe(devtunnelPath);
	const existing = loadTunnelState();

	if (existing?.tunnelId) {
		try {
			execSync(`"${devtunnelPath}" show ${existing.tunnelId}`, {
				stdio: "ignore",
			});
			console.log(
				`[Tunnel] Reusing existing tunnel: ${existing.tunnelId}`,
			);
			return existing;
		} catch {
			console.log(
				`[Tunnel] Saved tunnel no longer exists, creating new one...`,
			);
		}
	}

	// Create a new tunnel
	console.log("[Tunnel] Creating new tunnel...");
	const createOut = run("create");
	// Parse tunnel ID from output like: "Created tunnel: abc12345"
	const tunnelId = createOut.match(/Created tunnel: (\S+)/)?.[1]?.trim();
	if (!tunnelId) {
		throw new Error(`Failed to parse tunnel ID from: ${createOut}`);
	}

	// Also grab cluster from the host URL if available
	const cluster = createOut.match(/https:\/\/(\S+?)\./)?.[1] || "usw2";

	console.log(`[Tunnel] Created tunnel: ${tunnelId} (cluster: ${cluster})`);

	// Add ports
	for (const port of PORTS) {
		try {
			run(`port create ${tunnelId} -p ${port} --allow-anonymous`);
			console.log(`[Tunnel] Added port ${port}`);
		} catch {
			// Port may already exist, that's fine
			console.log(`[Tunnel] Port ${port} may already exist`);
		}
	}

	const state = { tunnelId, cluster };
	saveTunnelState(state);
	return state;
}

module.exports = {
	name: "startDevTunnels",
	description:
		"Creates and hosts dev tunnels for webhook ports via Microsoft devtunnel CLI",
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

		let state;
		try {
			state = ensureTunnel(devtunnelPath);
		} catch (err) {
			console.error("[Tunnel] Setup failed:", err.message);
			return;
		}

		// Store URLs on client for other tasks
		client.devTunnelUrls = {};

		// Spawn the host process
		const hostArgs = [
			"host",
			state.tunnelId,
			"--allow-anonymous",
		];

		console.log(`[Tunnel] Starting: ${hostArgs.join(" ")}`);

		const proc = spawn(devtunnelPath, hostArgs, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		this.processes.push(proc);

		proc.stdout.on("data", (data) => {
			const output = data.toString();
			console.log(`[devtunnel] ${output.trim()}`);

			// Parse URLs from output like:
			// "Port 3001: https://abc12345-3001.usw2.devtunnels.ms/"
			for (const port of PORTS) {
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
			}
		});

		proc.stderr.on("data", (data) => {
			console.error(`[devtunnel ERR] ${data.toString().trim()}`);
		});

		proc.on("exit", (code) => {
			console.log(`[Tunnel] Process exited with code ${code}`);
		});
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
