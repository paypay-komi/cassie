/**
 * Posts text commands to top.gg via the v1 API.
 * Endpoint: PUT /projects/@me/commands
 * https://docs.top.gg/api/v1/projects
 */
async function postCommandsToTopgg(client) {
  const commands = [];

  for (const cmd of client.textCommands.values()) {
    const hasSubs = Object.keys(cmd.subcommands).length > 0;

    commands.push({
      name: cmd.name,
      description: cmd.description || "No description",
      type: 1, // CHAT_INPUT
      options: hasSubs ? walkTree(cmd) : [],
    });
  }

  const res = await fetch(
    "https://top.gg/api/v1/projects/@me/commands",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TOPGG_TOKEN}`,
      },
      body: JSON.stringify(commands),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`top.gg returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return commands.length;
}

function walkTree(cmd) {
  const options = [];

  for (const sub of Object.values(cmd.subcommands)) {
    if (!sub.parentRef || sub.parentRef.name !== cmd.name) continue;

    const hasSubs = Object.keys(sub.subcommands).length > 0;

    options.push({
      name: sub.name,
      description: sub.description || "No description",
      type: hasSubs ? 2 : 1, // SUB_COMMAND or SUB_COMMAND_GROUP
      options: hasSubs ? walkTree(sub) : [],
    });
  }

  return options;
}

module.exports = { postCommandsToTopgg, walkTree };
