const test = require("node:test");
const assert = require("node:assert");
const { scoreToxicity, parseToxicity, resetClassifier } = require("../lib/toxicity");

test("parseToxicity handles nested/flat results", () => {
	const r = [[{ label: "toxic", score: 0.2 }, { label: "insult", score: 0.95 }]];
	assert.deepEqual(parseToxicity(r), { label: "insult", score: 0.95 });
	assert.equal(parseToxicity(r[0]).score, 0.95);
	assert.equal(parseToxicity([]), null);
});

test("scoreToxicity uses the local classifier and loads it lazily, once", async () => {
	resetClassifier();
	let loads = 0;
	const loader = async () => {
		loads++;
		return async (text, o) => {
			assert.equal(o.top_k, null);
			return [{ label: "toxic", score: text.includes("idiot") ? 0.97 : 0.01 }];
		};
	};
	assert.equal(loads, 0);
	assert.equal((await scoreToxicity("you idiot", { loader })).score, 0.97);
	assert.equal((await scoreToxicity("hello", { loader })).score, 0.01);
	assert.equal(loads, 1);
	assert.equal(await scoreToxicity("   ", { loader }), null);
});

test("fails safe: load or inference errors return null, and loading retries", async () => {
	resetClassifier();
	assert.equal(await scoreToxicity("x", { loader: async () => { throw new Error("no model"); } }), null);
	const ok = async () => async () => [{ label: "toxic", score: 0.5 }];
	assert.equal((await scoreToxicity("x", { loader: ok })).score, 0.5);
	resetClassifier();
	const bad = async () => async () => { throw new Error("boom"); };
	assert.equal(await scoreToxicity("x", { loader: bad }), null);
});
