const { getLogger } = require("../../../lib/logger");
const { AutoPoster } = require("topgg-autoposter");
require("dotenv/config");

module.exports = {
  name: "startTopggStats",
  description: "Starts auto-posting guild stats to top.gg",
  needsReadyClient: true,
  execute(client) {
    const log = getLogger("TopGGStats");
    if (!process.env.TOPGG_TOKEN) {
      log.warn("[Top.gg] No TOPGG_TOKEN set — skipping stats posting");
      return;
    }

    const ap = AutoPoster(process.env.TOPGG_TOKEN, client);

    ap.on("posted", () => {
      log.info("[Top.gg] Stats posted successfully");
    });

    ap.on("error", (err) => {
      log.error("[Top.gg] Stats posting error:", err.message);
    });

    client.topggAutoposter = ap;
    log.info("[Top.gg] Auto-poster started");
  },
};
