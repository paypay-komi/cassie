const test = require("node:test");
const assert = require("node:assert");
const { hfChatRequest, toOpenAiMessages, isHfBackendEnabled } = require("../lib/hfChat");
const { scoreToxicity, parseToxicity } = require("../lib/toxicity");

const env = { HF_TOKEN: "test-token", AI_BACKEND: "hf" };
const sse = (chunks) =>
	new Response(chunks.map((c) => "data: " + (typeof c === "string" ? c : JSON.stringify(c)) + "\n\n").join(""));

test("backend is opt-in", () => {
	assert.equal(isHfBackendEnabled({}), false);
	assert.equal(isHfBackendEnabled({ HF_TOKEN: "x" }), false);
	assert.equal(isHfBackendEnabled(env), true);
});

test("toOpenAiMessages converts tool calls and ids", () => {
	const out = toOpenAiMessages([
		{ role: "user", content: "hi" },
		{ role: "assistant", content: "", tool_calls: [{ function: { name: "calculate", arguments: { expression: "1+1" } } }] },
		{ role: "tool", content: "2" },
	]);
	assert.equal(out[1].tool_calls[0].function.arguments, '{"expression":"1+1"}');
	assert.equal(out[2].tool_call_id, out[1].tool_calls[0].id);
});

test("streams SSE as ollama-format NDJSON incl. tool calls", async () => {
	let sent;
	const fetchMock = async (url, init) => {
		sent = { url, init };
		return sse([
			{ choices: [{ delta: { content: "hel" } }] },
			{ choices: [{ delta: { content: "lo" } }] },
			{ choices: [{ delta: { tool_calls: [{ index: 0, id: "c1", function: { name: "calculate", arguments: '{"expres' } }] } }] },
			{ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'sion":"2+2"}' } }] } }] },
			"[DONE]",
		]);
	};
	const res = await hfChatRequest([{ role: "user", content: "x" }], [{ type: "function" }], true, { env, fetch: fetchMock });
	assert.equal(sent.init.headers.Authorization, "Bearer test-token");
	assert.equal(JSON.parse(sent.init.body).model, "meta-llama/Llama-3.1-8B-Instruct");
	const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
	assert.equal(lines.filter((l) => l.message.content).map((l) => l.message.content).join(""), "hello");
	const tc = lines.find((l) => l.message.tool_calls).message.tool_calls[0];
	assert.deepEqual(tc.function, { name: "calculate", arguments: { expression: "2+2" } });
	assert.equal(lines.at(-1).done, true);
});

test("non-stream returns ollama-shaped json and errors on http failure", async () => {
	const ok = async () => Response.json({ choices: [{ message: { content: "hi there" } }] });
	const res = await hfChatRequest([], null, false, { env, fetch: ok });
	assert.equal((await res.json()).message.content, "hi there");
	const bad = async () => new Response("no", { status: 401, statusText: "Unauthorized" });
	await assert.rejects(hfChatRequest([], null, false, { env, fetch: bad }), /401/);
});

test("parseToxicity handles nested/flat results", () => {
	const r = [[{ label: "toxic", score: 0.2 }, { label: "insult", score: 0.95 }]];
	assert.deepEqual(parseToxicity(r), { label: "insult", score: 0.95 });
	assert.equal(parseToxicity(r[0]).score, 0.95);
	assert.equal(parseToxicity([]), null);
});

test("scoreToxicity calls model, and fails open", async () => {
	let body;
	const f = async (url, init) => {
		body = JSON.parse(init.body);
		assert.match(url, /unitary\/toxic-bert/);
		return Response.json([[{ label: "toxic", score: 0.99 }]]);
	};
	assert.equal((await scoreToxicity("you idiot", { env, fetch: f })).score, 0.99);
	assert.equal(body.inputs, "you idiot");
	assert.equal(await scoreToxicity("x", { env: {}, fetch: f }), null);
	assert.equal(await scoreToxicity("x", { env, fetch: async () => { throw new Error("net"); } }), null);
	assert.equal(await scoreToxicity("x", { env, fetch: async () => new Response("", { status: 500 }) }), null);
});
