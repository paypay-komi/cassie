const { postCommandsToDbl } = require("../../../utils/postCommandsToDbl");

module.exports = {
  name: "post commands to dbl",
  description: "posts all text commands to dbl",
  prerequisites: ["loadTextCommands", "initClientVars"],
  needsReadyClient: true,

  async execute(client) {
    try {
      const count = await postCommandsToDbl(client);
      console.log(`Posted ${count} commands to DBL`);
    } catch (err) {
      console.error("Failed to post commands to DBL:", err.message);
    }
  },
};
