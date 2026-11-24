const test = require("node:test");
const assert = require("node:assert");

const cmd = (() => {
	try { return require("../commands/text/utility/sticker"); } catch { return null; }
})();

test("sticker command loads and lists/posts stickers", { skip: !cmd }, async () => {
	const { Collection } = require("discord.js");
	const stickers = new Collection([["1", { name: "Buno-Break" }], ["2", { name: "sprout" }]]);
	const sent = [];
	const message = {
		guild: { stickers: { fetch: async () => stickers } },
		reply: async (m) => sent.push(["reply", m]),
		channel: { send: async (m) => sent.push(["send", m]) },
	};
	await cmd.execute(message, []);
	assert.equal(sent[0][0], "reply");
	await cmd.execute(message, ["buno"]);
	assert.equal(sent[1][0], "send");
	assert.equal(sent[1][1].stickers[0].name, "Buno-Break");
	await cmd.execute(message, ["nope"]);
	assert.equal(sent[2][0], "reply");
});
