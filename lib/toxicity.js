// Toxicity scoring via unitary/toxic-bert on the Hugging Face Inference API.
// Opt-in: needs HF_TOKEN in the environment AND the "toxicity" automod filter
// enabled for the guild. Fails open (returns null) on any error.

const TOXIC_BERT_URL = "https://router.huggingface.co/hf-inference/models/unitary/toxic-bert";
const MAX_CHARS = 1000;

function isToxicityAvailable(env = process.env) {
	return !!env.HF_TOKEN;
}

// HF returns [[{label,score},...]] (or the flat inner array). Return the
// highest score among the labels as a 0-1 number, plus the top label.
function parseToxicity(json) {
	const arr = Array.isArray(json?.[0]) ? json[0] : json;
	if (!Array.isArray(arr) || !arr.length) return null;
	let best = null;
	for (const item of arr) {
		if (typeof item?.score !== "number") continue;
		if (!best || item.score > best.score) best = { label: item.label, score: item.score };
	}
	return best;
}

async function scoreToxicity(text, opts = {}) {
	const env = opts.env || process.env;
	const fetchImpl = opts.fetch || fetch;
	const trimmed = (text || "").trim().slice(0, MAX_CHARS);
	if (!trimmed || !env.HF_TOKEN) return null;
	try {
		const res = await fetchImpl(TOXIC_BERT_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.HF_TOKEN}` },
			body: JSON.stringify({ inputs: trimmed }),
		});
		if (!res.ok) return null;
		return parseToxicity(await res.json());
	} catch {
		return null;
	}
}

module.exports = { scoreToxicity, parseToxicity, isToxicityAvailable, TOXIC_BERT_URL };
