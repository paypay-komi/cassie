const { ShardingManager } = require('discord.js');
const path = require('path');
const config = require('./config.json');

const manager = new ShardingManager(path.join(__dirname, 'bot.js'), {
  token: config.token,
  totalShards: 'auto'
});

manager.on('shardCreate', shard => {
  console.log('Launched shard ' + shard.id);
});

manager.spawn();
