module.exports = {
  name: 'messageCreate',
  execute(client, message) {
    if (message.author.bot) return;
    if (!message.content.startsWith(client.prefix)) return;
    const args = message.content.slice(client.prefix.length).trim().split(/ +/);
    const cmdName = args.shift().toLowerCase();
    const cmd = client.textCommands.get(cmdName);
    if (!cmd) return;
    cmd.execute(message, args);
  }
};
