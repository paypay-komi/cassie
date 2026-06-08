const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../lib/logger");
const { pingSafeMesage } = require("../../utils/safeMsg");

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
			userId, "user", userInput, guildId, channelId,
		);

		try {
			await message.channel.sendTyping();

			const response = await fetch("http://localhost:11434/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: "llama3.1:latest",
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

			let lastFinalized = 0;   // chars already written to complete messages
			let activeMsg = null;   // message currently being edited

			/**
			 * Edit the active message with whatever we have so far.
			 * When the active message fills up (2000 chars), finalize it
			 * and start a new one — so overflow appears in real-time.
			 */
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
					// Active message is full — finalize it with the first 2000
					await activeMsg.edit(
						pingSafeMesage(activeContent.slice(0, DISCORD_LIMIT)),
					);
					lastFinalized += DISCORD_LIMIT;

					// Start a new active message with what's left
					const rest = activeContent.slice(DISCORD_LIMIT);
					activeMsg = await message.channel.send(
						pingSafeMesage(rest || "‎"),
					);
				}
			}

			// ---------- stream loop ----------

			let lastEdit = 0;

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

						const now = Date.now();
						if (now - lastEdit > EDIT_INTERVAL) {
							lastEdit = now;
							await updateStream();
						}
					}
				}
			}

			// Final update — makes sure the last message is complete
			await updateStream();

			// Persist assistant response to DB
			await message.client.db.chatHistory.add(
				userId, "assistant", fullResponse, guildId, channelId,
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
