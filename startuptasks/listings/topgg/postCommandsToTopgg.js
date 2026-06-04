const { getLogger } = require("../../../lib/logger");
const { postCommandsToTopgg } = require("../../../utils/postCommandsToTopgg");

module.exports = {
  name: "post commands to top.gg",
  description: "posts all text commands to top.gg",
  prerequisites: ["loadTextCommands", "initClientVars"],
  needsReadyClient: true,

  async execute(client) {
    const log = getLogger("TopGG");
    if (!process.env.TOPGG_TOKEN) {
      log.warn("[Top.gg] No TOPGG_TOKEN set — skipping command posting");
      return;
    }

    try {
      const count = await postCommandsToTopgg(client);
      log.info(`[Top.gg] Posted ${count} commands to top.gg`);
    } catch (err) {
      log.error("[Top.gg] Failed to post commands:", err.message);
    }
  },
};
