module.exports = {
  name: 'ready',
  execute(client) {
    console.log('Shard ready: ' + client.user.tag);
  }
};
