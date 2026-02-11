const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const deploySlashCommands = require('./utils/depolySlashcommands');
const reloadTextcommands = require('./utils/reloadTextcommands');
const reloadSlashcommands = require('./utils/reloadSlashcommands');
const reloadEvents = require('./utils/reloadEvents');

// --------------------------------------------------
// Client Setup
// --------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
client.owners = config.owners || [];
client.slashCommands = new Collection();
client.textCommands = new Collection();
client.subcommandMap = {};          // parent → { subName → command }
client.commandSettings = {};        // future per-channel/role/user overrides
client.prefix = config.prefix;
client.db = require('./db/boobs.js'); // Prisma client instance
// --------------------------------------------------
// Helper: Safe loader
// --------------------------------------------------
function loadFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.js'));
}
reloadTextcommands(client);

reloadSlashcommands(client);
// --------------------------------------------------
// Load Events
// --------------------------------------------------
reloadEvents(client);


// --------------------------------------------------
// Deploy Slash Commands
// --------------------------------------------------
deploySlashCommands({
  token: config.token,
  clientId: config.clientId,
  global: true
}).catch(console.error);


// --------------------------------------------------
// Login
// --------------------------------------------------
client.login(config.token);
