// Optional Hugging Face Inference Providers backend for c.ai / c.chat.
// Opt-in: set AI_BACKEND=hf and HF_TOKEN in the environment. Otherwise the
// existing local Ollama backend is used unchanged.
//
// The chat command speaks Ollama's wire format (NDJSON stream with
// { message: { content, tool_calls } }), so this adapter translates the
// OpenAI-compatible HF router API into that shape.

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

function isHfBackendEnabled(env = process.env) {
	return env.AI_BACKEND === "hf" && !!env.HF_TOKEN;
}

// Ollama -> OpenAI messages. Ollama tool_calls carry object arguments and no
// ids; OpenAI needs string arguments and ids that the tool results reference.
function toOpenAiMessages(messages) {
	const out = [];
	let pendingIds = [];
	let counter = 0;
	for (const m of messages) {
		if (m.role === "assistant" && m.tool_calls?.length) {
			pendingIds = [];
			const tool_calls = m.tool_calls.map((tc) => {
				const id = tc.id || `call_${counter++}`;
				pendingIds.push(id);
				const args = tc.function?.arguments;
				return {
					id,
					type: "function",
					function: {
						name: tc.function?.name,
						arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}),
					},
				};
			});
			out.push({ role: "assistant", content: m.content || "", tool_calls });
		} else if (m.role === "tool") {
			out.push({
				role: "tool",
				tool_call_id: m.tool_call_id || pendingIds.shift() || `call_${counter++}`,
				content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
			});
		} else {
			out.push({ role: m.role, content: m.content });
		}
	}
	return out;
}

function parseArgs(raw) {
	if (raw && typeof raw === "object") return raw;
	try {
		return JSON.parse(raw || "{}");
	} catch {
		return {};
	}
}

function finalizeToolCalls(acc) {
	return Object.keys(acc)
		.sort((a, b) => a - b)
		.map((i) => ({
			id: acc[i].id,
			function: { name: acc[i].name, arguments: parseArgs(acc[i].args) },
		}));
}

// Turn an OpenAI SSE body into an NDJSON ReadableStream in Ollama's format.
function sseToOllamaStream(body) {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	const reader = body.getReader();
	let buffer = "";
	const toolAcc = {};
	const line = (obj) => encoder.encode(JSON.stringify(obj) + "\n");

	return new ReadableStream({
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) {
				const calls = finalizeToolCalls(toolAcc);
				if (calls.length) {
					controller.enqueue(line({ message: { role: "assistant", content: "", tool_calls: calls } }));
				}
				controller.enqueue(line({ message: { role: "assistant", content: "" }, done: true }));
				controller.close();
				return;
			}
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop();
			for (const raw of lines) {
				const l = raw.trim();
				if (!l.startsWith("data:")) continue;
				const data = l.slice(5).trim();
				if (!data || data === "[DONE]") continue;
				let parsed;
				try {
					parsed = JSON.parse(data);
				} catch {
					continue;
				}
				const delta = parsed.choices?.[0]?.delta;
				if (!delta) continue;
				if (delta.content) {
					controller.enqueue(line({ message: { role: "assistant", content: delta.content } }));
				}
				for (const tc of delta.tool_calls || []) {
					const i = tc.index ?? 0;
					toolAcc[i] ||= { id: undefined, name: "", args: "" };
					if (tc.id) toolAcc[i].id = tc.id;
					if (tc.function?.name) toolAcc[i].name += tc.function.name;
					if (tc.function?.arguments) toolAcc[i].args += tc.function.arguments;
				}
			}
		},
		cancel() {
			return reader.cancel();
		},
	});
}

/**
 * Drop-in replacement for the Ollama request: resolves to a fetch Response.
 * stream=true  -> body is an NDJSON stream in Ollama format
 * stream=false -> response.json() is { message: { content, tool_calls } }
 */
async function hfChatRequest(messages, tools = null, stream = false, opts = {}) {
	const env = opts.env || process.env;
	const fetchImpl = opts.fetch || fetch;
	const response = await fetchImpl(HF_CHAT_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.HF_TOKEN}`,
		},
		body: JSON.stringify({
			model: env.HF_CHAT_MODEL || DEFAULT_MODEL,
			messages: toOpenAiMessages(messages),
			...(tools?.length ? { tools } : {}),
			max_tokens: Number(env.HF_CHAT_MAX_TOKENS) || 1024,
			stream,
		}),
	});

	if (!response.ok) {
		throw new Error(`Hugging Face chat failed: ${response.status} ${response.statusText}`);
	}

	if (stream) {
		return new Response(sseToOllamaStream(response.body), {
			headers: { "Content-Type": "application/x-ndjson" },
		});
	}

	const json = await response.json();
	const msg = json.choices?.[0]?.message || {};
	const tool_calls = (msg.tool_calls || []).map((tc) => ({
		id: tc.id,
		function: { name: tc.function?.name, arguments: parseArgs(tc.function?.arguments) },
	}));
	return new Response(
		JSON.stringify({
			message: { role: "assistant", content: msg.content || "", ...(tool_calls.length ? { tool_calls } : {}) },
			done: true,
		}),
		{ headers: { "Content-Type": "application/json" } },
	);
}

module.exports = { hfChatRequest, isHfBackendEnabled, toOpenAiMessages, sseToOllamaStream, HF_CHAT_URL, DEFAULT_MODEL };
