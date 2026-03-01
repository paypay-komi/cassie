const conversations = new Map();

const SYSTEM_PROMPT = {
	role: "system",
	content:
		"You are a helpful, intelligent Discord assistant. Be concise but informative.",
};

const EDIT_INTERVAL = 300; // throttle edits (ms)
const DISCORD_LIMIT = 2000;

module.exports = {
	name: "chat",
	description: "Chat with AI (streaming, formatted)",
	aliases: ["talk", "gpt", "ai"],

	async execute(message, args) {
		const userInput = args.join(" ");
		if (!userInput) {
			return message.reply(
				"Please provide a message to chat with the bot.",
			);
		}

		const userId = message.author.id;

		if (!conversations.has(userId)) {
			conversations.set(userId, [SYSTEM_PROMPT]);
		}

		const convo = conversations.get(userId);

		convo.push({
			role: "user",
			content: userInput,
		});

		try {
			await message.channel.sendTyping();

			const response = await fetch("http://localhost:11434/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: "gemma3",
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

			let replyMessage = await message.reply("‎"); // invisible starter

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

			// Save clean assistant response
			convo.push({
				role: "assistant",
				content: fullResponse,
			});

			// Trim memory (system + last 20 messages)
			if (convo.length > 21) {
				conversations.set(userId, [SYSTEM_PROMPT, ...convo.slice(-20)]);
			}

			// ===== Helper to update message safely =====
			async function updateMessage(final = false) {
				const displayText = fixCodeBlocks(fullResponse);

				if (displayText.length <= DISCORD_LIMIT) {
					await replyMessage.edit(displayText || "‎");
				} else {
					// Handle overflow
					await replyMessage.edit(
						displayText.slice(0, DISCORD_LIMIT),
					);

					let remaining = displayText.slice(DISCORD_LIMIT);

					while (remaining.length > 0) {
						const chunk = remaining.slice(0, DISCORD_LIMIT);
						remaining = remaining.slice(DISCORD_LIMIT);
						replyMessage = await message.channel.send(chunk);
					}
				}
			}
		} catch (err) {
			console.error("Streaming error:", err);
			message.reply("Streaming failed. Check Ollama and try again.");
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
