const EventEmitter = require("events");

const globalKey = Symbol.for("voteEmitter.singleton");

if (!globalThis[globalKey]) {
	globalThis[globalKey] = new EventEmitter();
}

module.exports = globalThis[globalKey];
