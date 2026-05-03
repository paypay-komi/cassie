const db = require("../../db/boobs.js");
const { distance } = require("fastest-levenshtein");

// cache
let ideaCache = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function getIdeas() {
	const now = Date.now();
	if (ideaCache.length > 0 && now - lastCacheUpdate < CACHE_TTL) {
		return ideaCache;
	}

	ideaCache = await db.prisma.idea.findMany({
		where: { status: { in: ["approved", "pending"] } },
		select: { content: true },
	});
	lastCacheUpdate = now;
	return ideaCache;
}

function bustIdeaCache() {
	ideaCache = [];
	lastCacheUpdate = 0;
}

function levenshteinSimilarity(a, b) {
	const maxLen = Math.max(a.length, b.length);
	if (maxLen === 0) return 1;
	return 1 - distance(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

async function checkDuplicate(idea) {
	const existing = await getIdeas();

	for (const existing_idea of existing) {
		const similarity = levenshteinSimilarity(idea, existing_idea.content);
		if (similarity > 0.9)
			return {
				result: "rejected",
				reason: `already suggested: "${existing_idea.content}"`,
			};
		if (similarity > 0.8)
			return {
				result: "pending",
				reason: `similar to existing idea: "${existing_idea.content}"`,
			};
	}

	return { result: "pass" };
}

async function checkOpenAIModeration(idea) {
	const response = await fetch("https://api.openai.com/v1/moderations", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
		},
		body: JSON.stringify({
			input: idea,
		}),
	});

	const data = await response.json();

	if (!data.results?.[0]) {
		console.error("Unexpected OpenAI response:", data);
		return { result: "pass" }; // fail open
	}
	const result = data.results[0];

	// clearly flagged by openai
	if (result.flagged) {
		const triggeredCategories = Object.entries(result.categories)
			.filter(([_, flagged]) => flagged)
			.map(([category]) => category);

		return {
			result: "rejected",
			reason: `idea flagged for: ${triggeredCategories.join(", ")}`,
		};
	}

	// check scores for borderline content even if not flagged
	const scores = result.category_scores;
	const borderline = Object.entries(scores).some(([_, score]) => score > 0.5);
	if (borderline)
		return {
			result: "pending",
			reason: "idea may contain borderline content",
		};

	return { result: "pass" };
}

async function checkOllama(idea) {
	const response = await fetch("http://localhost:11434/api/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: "gemma3",
			stream: false,
			messages: [
				{
					role: "system",
					content: `You are a quality filter for a Discord bot idea suggestion board. Your job is to classify ideas, not judge them.

Respond ONLY with raw JSON. No markdown, no backticks, no explanation.
Format: {"result": "approved" | "pending" | "rejected", "reason": "reason"}

APPROVED - clear, specific, actionable suggestion for a Discord bot feature:
✓ "add a command that shows the current weather for any city"
✓ "add a starboard that pins highly reacted messages"
✓ "add a command that automatically deletes messages with slurs"

PENDING - real idea but too vague, needs more detail, or borderline:
✓ "add better moderation tools" → what specific tools?
✓ "make the bot more fun" → how specifically?
✓ "add a music thing" → what kind of music feature?

REJECTED - not a real idea, gibberish, harmful, or physically impossible for software:
✗ "asjdhaksjdh askjdh" → gibberish
✗ "add a command that makes me a sandwich" → bots cannot interact with the physical world
✗ "add a command that turns on my lights" → bots cannot control hardware
✗ "add a command that sends me a text" → bots cannot send SMS
✗ "add a feature that prints server stats" → bots cannot control printers
✗ "add a command to doxx members" → harmful

KEY RULES:
- You are judging if it is a REAL IDEA, not a GOOD or ALLOWED idea
- A coherent suggestion a reasonable person could want = at minimum pending
- Only reject things that are not ideas at all, or are physically impossible for software`,
				},
				{
					role: "user",
					content: `Evaluate only the text inside the tags: <idea>${idea}</idea>`,
				},
			],
		}),
	});

	const data = await response.json();
	const raw = data.message.content.replace(/```json|```/g, "").trim();

	try {
		const parsed = JSON.parse(raw);
		if (!["approved", "pending", "rejected"].includes(parsed.result)) {
			return {
				result: "pending",
				reason: "could not determine idea quality",
			};
		}
		return parsed;
	} catch {
		if (/\brejected\b/i.test(raw))
			return {
				result: "rejected",
				reason: "idea did not pass quality check",
			};
		if (/\bapproved\b/i.test(raw))
			return { result: "approved", reason: null };
		return {
			result: "pending",
			reason: "could not determine idea quality",
		};
	}
}

async function validateIdea(idea) {
	// layer 1: duplicate check
	try {
		const duplicate = await checkDuplicate(idea);
		if (duplicate.result === "rejected") return duplicate;
		if (duplicate.result === "pending") return duplicate;
	} catch (err) {
		console.error("duplicate check failed, skipping:", err);
	}

	// layer 2: openai moderation
	try {
		const moderation = await checkOpenAIModeration(idea);
		if (moderation.result === "rejected") return moderation;
		if (moderation.result === "pending") return moderation;
	} catch (err) {
		console.error("OpenAI moderation failed, skipping:", err);
	}

	// layer 3: ollama semantic check
	try {
		return await checkOllama(idea);
	} catch (err) {
		console.error("Ollama check failed, skipping:", err);
		return { result: "pending", reason: "could not verify idea quality" };
	}
}

module.exports = { validateIdea, bustIdeaCache };
