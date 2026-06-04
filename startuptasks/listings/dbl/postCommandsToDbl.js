const { getLogger } = require("../../../lib/logger");
const { postCommandsToDbl } = require("../../../utils/postCommandsToDbl");

module.exports = {
  name: "post commands to dbl",
  description: "posts all text commands to dbl",
  prerequisites: ["loadTextCommands", "initClientVars"],
  needsReadyClient: true,

  async execute(client) {
    const log = getLogger("DBL");
    try {
      const count = await postCommandsToDbl(client);
      log.info(`Posted ${count} commands to DBL`);
    } catch (err) {
      log.error("Failed to post commands to DBL:", err.message);
    }
  },
};
