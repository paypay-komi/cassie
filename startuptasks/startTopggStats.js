const { AutoPoster } = require("topgg-autoposter");
require("dotenv/config");

module.exports = {
  name: "startTopggStats",
  description: "Starts auto-posting guild stats to top.gg",
  needsReadyClient: true,
  execute(client) {
    if (!process.env.TOPGG_TOKEN) {
      console.warn("[Top.gg] No TOPGG_TOKEN set — skipping stats posting");
      return;
    }

    const ap = AutoPoster(process.env.TOPGG_TOKEN, client);

    ap.on("posted", () => {
      console.log("[Top.gg] Stats posted successfully");
    });

    ap.on("error", (err) => {
      console.error("[Top.gg] Stats posting error:", err.message);
    });

    client.topggAutoposter = ap;
    console.log("[Top.gg] Auto-poster started");
  },
};
