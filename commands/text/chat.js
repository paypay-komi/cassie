const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../lib/logger");
const { pingSafeMesage } = require("../../utils/safeMsg");
const { ArgsBuilder } = require("../../lib/argsBuilder");

const SYSTEM_PROMPT = {
	role: "system",
	content:
		"You are a helpful, intelligent Discord assistant. Be concise but informative.",
};

const MAX_HISTORY = 20;
const EDIT_INTERVAL = 1000; // throttle edits (ms) — Discord is ~1/sec per message
const DISCORD_LIMIT = 2000;

module.exports = {
	commandId: "2d1ce4a6-c5ec-47ed-a085-a9d9f1264b49",
	name: "chat",
	description: "Chat with AI (streaming, formatted)",
	args: ArgsBuilder.create().string("message", {
		required: true,
		description: "Message for the AI",
	}),
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
	],
	aliases: ["talk", "gpt", "ai"],

	async execute(message, args) {
		const userInput = args.join(" ");
		if (!userInput) {
			return message.reply(
				"Please provide a message to chat with the bot.",
			);
		}

		const userId = message.author.id;
		const guildId = message.guild?.id || null;
		const channelId = message.channel.id;
		const log = getLogger("Chat");

		// Load conversation history from DB
		const history = await message.client.db.chatHistory.getRecent(
			userId,
			MAX_HISTORY,
		);

		// Build context: system prompt + past messages (chronological) + new user message
		const convo = [SYSTEM_PROMPT];

		for (const msg of history.reverse()) {
			if (msg.role === "user" || msg.role === "assistant") {
				convo.push({ role: msg.role, content: msg.content });
			}
		}

		convo.push({ role: "user", content: userInput });

		// Save user message to DB immediately
		await message.client.db.chatHistory.add(
			userId,
			"user",
			userInput,
			guildId,
			channelId,
		);

		try {
			await message.channel.sendTyping();

			const response = await fetch("http://localhost:11434/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: "llama3.1:latest",
					keep_alive: "0s",
					messages: convo,
					stream: true,
				}),
			});

			if (!response.body) throw new Error("No response body");

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			let buffer = "";
			let fullResponse = "";

			// ---------- streaming helpers ----------

			let lastFinalized = 0; // chars already written to complete messages
			let activeMsg = null; // message currently being edited

			/**
			 * Edit the active message with whatever we have so far.
			 * When the active message fills up (2000 chars), finalize it
			 * and start a new one — so overflow appears in real-time.
			 */
			/**
			 * Find the best split point within `limit` chars.
			 * Priority: newline → sentence end → punctuation → word → hard limit.
			 */
			function splitPoint(text, limit) {
				// Newline — keeps paragraphs intact
				let idx = text.lastIndexOf("\n", limit);
				if (idx > limit * 0.4) return idx + 1;

				// Sentence end — split after . ! ?
				idx = Math.max(
					text.lastIndexOf(".", limit),
					text.lastIndexOf("!", limit),
					text.lastIndexOf("?", limit),
				);
				if (idx > limit * 0.4) return idx + 1;

				// Punctuation — mid-sentence commas, semicolons, colons
				idx = Math.max(
					text.lastIndexOf(",", limit),
					text.lastIndexOf(";", limit),
					text.lastIndexOf(":", limit),
				);
				if (idx > limit * 0.4) return idx + 1;

				// Word boundary — last space
				idx = text.lastIndexOf(" ", limit);
				if (idx > limit * 0.4) return idx + 1;

				// Hard fallback
				return limit;
			}

			async function updateStream() {
				const displayText = fixCodeBlocks(fullResponse);
				const trimmed = displayText.trim();

				if (!activeMsg) {
					activeMsg = await message.reply(pingSafeMesage("‎"));
				}

				const activeContent = trimmed.slice(lastFinalized);

				if (activeContent.length <= DISCORD_LIMIT) {
					await activeMsg.edit(pingSafeMesage(activeContent || "‎"));
				} else {
					const split = splitPoint(activeContent, DISCORD_LIMIT);

					await activeMsg.edit(
						pingSafeMesage(activeContent.slice(0, split)),
					);
					lastFinalized += split;

					const rest = activeContent.slice(split).trimStart();
					activeMsg = await message.channel.send(
						pingSafeMesage(rest || "‎"),
					);
				}
			}

			// ---------- stream loop ----------

			let lastEdit = 0;
			let loopDetected = false;
			let lastLoopCheck = 0; // char count at last loop detection run

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split("\n");
				buffer = lines.pop();

				for (const line of lines) {
					if (!line.trim()) continue;

					let parsed;
					try {
						parsed = JSON.parse(line);
					} catch {
						continue;
					}

					if (parsed.message?.content) {
						fullResponse += parsed.message.content;

						// Check for infinite loop patterns
						// Only run every ~200 chars of growth to avoid O(n) spam
						if (fullResponse.length - lastLoopCheck >= 200) {
							lastLoopCheck = fullResponse.length;
							if (detectLoop(fullResponse)) {
								reader.cancel().catch(() => {});
								loopDetected = true;
								break;
							}
						}

						const now = Date.now();
						if (now - lastEdit > EDIT_INTERVAL) {
							lastEdit = now;
							await updateStream();
						}
					}
				}

				if (loopDetected) break;
			}

			// Final update — makes sure the last message is complete
			await updateStream();

			if (loopDetected) {
				await message.channel.send(
					"⚠️ The model seemed to get stuck in a loop, so I stopped it. Try rephrasing your question.",
				);
			}

			// Persist assistant response to DB
			await message.client.db.chatHistory.add(
				userId,
				"assistant",
				fullResponse,
				guildId,
				channelId,
			);
		} catch (err) {
			log.error("Streaming error:", err);
			message.reply(
				pingSafeMesage("Streaming failed. Check Ollama and try again."),
			);
		}
	},
};

// ==========================
// Loop detection — catch infinite counting/repeating
// ==========================
function detectLoop(text) {
	if (text.length < 800) return false;

	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	if (lines.length < 12) return false;

	// 1. Same short line repeated 12+ times — clearly stuck
	const counts = {};
	for (const line of lines) {
		if (line.length >= 4 && line.length <= 80) {
			counts[line] = (counts[line] || 0) + 1;
		}
	}
	for (const count of Object.values(counts)) {
		if (count >= 12) return true;
	}

	// 2. Sequential numbering — like "1. ... 2. ... 3. ..."
	// Needs 25+ numbered lines dominating 50%+ of output to fire
	const numbered = lines.filter((l) => /^\d+[\.\)]/.test(l));
	if (numbered.length >= 25 && numbered.length > lines.length * 0.5) {
		return true;
	}

	// 3. Very low variety in recent output — last 25 lines
	const recent = lines.slice(-25);
	if (recent.length >= 15) {
		const unique = new Set(recent);
		if (unique.size <= 4) return true;
	}

	return false;
}

// ==========================
// Code Block Auto Fixer
// ==========================
function fixCodeBlocks(text) {
	const matches = text.match(/```/g);
	const count = matches ? matches.length : 0;

	if (count % 2 !== 0) {
		return text + "\n```";
	}

	return text;
}
