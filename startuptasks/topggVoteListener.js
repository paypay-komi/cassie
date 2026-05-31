const express = require("express");
const Topgg = require("@top-gg/sdk");
const voteEmitter = require("../utils/voteEmitter");
require("dotenv/config");

module.exports = {
  name: "topggVoteListener",
  description: "Starts the top.gg vote webhook endpoint",
  reloadAble: true,

  server: null,
  app: null,

  execute(client) {
    this.cleanup();

    const secret = process.env.TOPGG_WEBHOOK_SECRET;
    if (!secret) {
      console.warn("[Top.gg] No TOPGG_WEBHOOK_SECRET set — vote webhook not registered");
      return;
    }

    const app = express();
    this.app = app;

    // The @top-gg/sdk Webhook middleware parses the raw body itself,
    // so we don't use express.json() here.
    const webhook = new Topgg.Webhook(secret);

    app.post("/topgg", webhook.listener((vote) => {
      // vote.user is the Discord user ID (SDK normalizes across v0/v1)
      if (!vote.user) {
        // v1 payload: vote.data?.user?.platform_id
        const userId = vote.data?.user?.platform_id;
        if (!userId) {
          console.warn("[Top.gg] Received vote without user ID:", JSON.stringify(vote).slice(0, 200));
          return;
        }
        voteEmitter.emit("vote", {
          userId,
          site: "topgg",
        });
        return;
      }

      voteEmitter.emit("vote", {
        userId: vote.user,
        site: "topgg",
      });
    }));

    app.get("/", (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Cassie's Backend</title></head>
          <body><h1>top.gg Vote Listener Running</h1></body>
        </html>
      `);
    });

    this.server = app.listen(3003, () => {
      console.log("[Top.gg] Vote webhook running on port 3003");
    });
  },

  cleanup() {
    if (this.server) this.server.close();
    this.server = null;
    this.app = null;
  },
};
