const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../lib/logger");
const { pingSafeMesage } = require("../../utils/safeMsg");

const SYSTEM_PROMPT = {
	role: "system",
	content:
		"You are a helpful, intelligent Discord assistant. Be concise but informative.",
};

const MAX_HISTORY = 20; // how many past messages to include as context
const EDIT_INTERVAL = 300; // throttle edits (ms)
const DISCORD_LIMIT = 2000;

module.exports = {
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

		// Load conversation history from DB
		const history = await message.client.db.chatHistory.getRecent(
			userId,
			MAX_HISTORY,
		);

		// Build context: system prompt + past messages (chronological) + new user message
		const convo = [SYSTEM_PROMPT];

		// history comes back newest-first, reverse for chronological order
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
					messages: convo,
					stream: true,
				}),
			});

			if (!response.body) throw new Error("No response body");

			const reader = response.body.getReader();
			const decoder = new TextDecoder();

			let buffer = "";
			let fullResponse = "";
			let lastEdit = 0;

			let replyMessage = await message.reply(pingSafeMesage("‎"));

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
							await updateMessage();
						}
					}
				}
			}

			// Final edit
			await updateMessage(true);

			// Persist assistant response to DB
			await message.client.db.chatHistory.add(
				userId,
				"assistant",
				fullResponse,
				guildId,
				channelId,
			);

			// ===== Helper to update message safely =====
			async function updateMessage(final = false) {
				const displayText = fixCodeBlocks(fullResponse);

				if (displayText.length <= DISCORD_LIMIT) {
					await replyMessage.edit(
						pingSafeMesage(displayText.trim() || "‎"),
					);
				} else {
					await replyMessage.edit(
						pingSafeMesage(displayText.slice(0, DISCORD_LIMIT)),
					);

					let remaining = displayText.slice(DISCORD_LIMIT);

					while (remaining.length > 0) {
						const chunk = remaining.slice(0, DISCORD_LIMIT);
						remaining = remaining.slice(DISCORD_LIMIT);
						replyMessage = await message.channel.send(
							pingSafeMesage(chunk),
						);
					}
				}
			}
		} catch (err) {
			getLogger("Chat").error("Streaming error:", err);
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
