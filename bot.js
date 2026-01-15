const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.slashCommands = new Collection();
client.textCommands = new Collection();
client.prefix = config.prefix;

const slashPath = path.join(__dirname, 'commands/slash');
for (const file of fs.readdirSync(slashPath)) {
  const cmd = require('./commands/slash/' + file);
  client.slashCommands.set(cmd.data.name, cmd);
}

const textPath = path.join(__dirname, 'commands/text');
for (const file of fs.readdirSync(textPath)) {
  const cmd = require('./commands/text/' + file);
  client.textCommands.set(cmd.name, cmd);
}

const eventsPath = path.join(__dirname, 'events');
for (const file of fs.readdirSync(eventsPath)) {
  const evt = require('./events/' + file);
  client.on(evt.name, (...args) => evt.execute(client, ...args));
}

client.login(config.token);
