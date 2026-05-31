const EventEmitter = require("events");

class VoteEmitter extends EventEmitter {}
const voteEmitter = new VoteEmitter();

module.exports = voteEmitter;
