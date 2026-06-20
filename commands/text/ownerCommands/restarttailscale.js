const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const { execSync } = require("child_process");

module.exports = {
	commandId: "f7e8d9c0-b1a2-3344-5566-778899aabbcc",
	name: "restarttailscale",
	aliases: ["rts", "restartts", "tsrestart"],
	description: "Restart Tailscale service and funnel on port 3000.",
	permissions: ["botOwner"],

	async execute(message) {
		const log = getLogger("RestartTS");
		const reply = await message.reply("🔄 Restarting Tailscale...");

		try {
			// 1. Reset funnel
			await reply.edit("🔄 Resetting Tailscale funnel...");
			execSync("tailscale funnel reset", { timeout: 15000, windowsHide: true });

			// 2. Restart Tailscale via CLI (no admin needed)
			await reply.edit("🔄 Restarting Tailscale...");
			execSync("tailscale down", { timeout: 15000, windowsHide: true });
			await new Promise((r) => setTimeout(r, 3000));
			execSync("tailscale up", { timeout: 30000, windowsHide: true });

			// Wait for service to be ready
			await new Promise((r) => setTimeout(r, 5000));

			// 3. Start funnel on port 3000
			await reply.edit("🔄 Starting funnel on port 3000...");
			execSync("tailscale funnel --bg 3000", { timeout: 15000, windowsHide: true });

			await reply.edit("✅ Tailscale restarted. Funnel should be active on port 3000.");
			log.info("Tailscale restart complete");
		} catch (err) {
			log.error("Tailscale restart failed:", err);
			await reply.edit(`❌ Tailscale restart failed: \`${err.message}\``);
		}
	},
};
