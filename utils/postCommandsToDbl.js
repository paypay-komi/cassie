function walkTree(cmd) {
  const options = [];

  for (const sub of Object.values(cmd.subcommands)) {
    if (!sub.parentRef || sub.parentRef.name !== cmd.name) continue;

    const hasSubs = Object.keys(sub.subcommands).length > 0;

    options.push({
      name: sub.name,
      description: sub.description || "No description",
      type: hasSubs ? 2 : 1,
      options: hasSubs ? walkTree(sub) : [],
    });
  }

  return options;
}

async function postCommandsToDbl(client) {
  const commands = [];

  for (const cmd of client.textCommands.values()) {
    const hasSubs = Object.keys(cmd.subcommands).length > 0;

    commands.push({
      name: cmd.name,
      description: cmd.description || "No description",
      type: 1,
      options: hasSubs ? walkTree(cmd) : [],
    });
  }

  const res = await fetch(
    `https://discordbotlist.com/api/v1/bots/${client.user.id}/commands`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DBL_API_TOKEN}`,
      },
      body: JSON.stringify(commands),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`DBL returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return commands.length;
}

module.exports = { postCommandsToDbl, walkTree };
