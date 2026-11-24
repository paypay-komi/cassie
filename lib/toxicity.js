// Fully local toxicity scoring: Xenova/toxic-bert (ONNX build of unitary/toxic-bert)
// running in-process via transformers.js. No hosted API calls.
//
// - Lazy: the model is only loaded the first time a guild has the "toxicity"
//   automod filter enabled and a message needs scoring.
// - One-time download (~110 MB quantized) into TOXICITY_CACHE_DIR (default:
//   ./.cache/transformers). After that it works offline.
// - Fails safe: if the model can't load or inference throws, scoreToxicity
//   returns null and nothing is punished.

const MODEL_ID = process.env.TOXICITY_MODEL || "Xenova/toxic-bert";
const MAX_CHARS = 1000;

let classifierPromise = null;

async function defaultLoader() {
	const { pipeline, env } = await import("@huggingface/transformers");
	env.cacheDir = process.env.TOXICITY_CACHE_DIR || "./.cache/transformers";
	return pipeline("text-classification", MODEL_ID, { dtype: "q8" });
}

function getClassifier(loader = defaultLoader) {
	if (!classifierPromise) {
		classifierPromise = loader().catch((err) => {
			classifierPromise = null; // allow a retry on a later message
			throw err;
		});
	}
	return classifierPromise;
}

function resetClassifier() {
	classifierPromise = null;
}

// Highest score among the labels (toxic, insult, threat, ...), 0-1.
function parseToxicity(out) {
	const arr = Array.isArray(out?.[0]) ? out[0] : out;
	if (!Array.isArray(arr) || !arr.length) return null;
	let best = null;
	for (const item of arr) {
		if (typeof item?.score !== "number") continue;
		if (!best || item.score > best.score) best = { label: item.label, score: item.score };
	}
	return best;
}

async function scoreToxicity(text, opts = {}) {
	const trimmed = (text || "").trim().slice(0, MAX_CHARS);
	if (!trimmed) return null;
	try {
		const classify = await getClassifier(opts.loader);
		return parseToxicity(await classify(trimmed, { top_k: null }));
	} catch {
		return null;
	}
}

module.exports = { scoreToxicity, parseToxicity, resetClassifier, MODEL_ID };
