module.exports = {
  name: 'clientReady',
  execute(client) {
    console.log('Shard ready: ' + client.user.tag);
  }
};
