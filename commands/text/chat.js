const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../lib/logger");
const { pingSafeMesage } = require("../../utils/safeMsg");
const { ArgsBuilder } = require("../../lib/argsBuilder");
const db = require("../../db");
const { DateTime } = require("luxon");
const restart = require("./ownerCommands/restart");
const MAX_HISTORY = 20;
const EDIT_INTERVAL = 1000;
const DISCORD_LIMIT = 2000;
const TYPING_REFRESH_INTERVAL = 8000; // Discord's typing indicator expires after ~10s

const OLLAMA_URL = "http://localhost:11434/api/chat";
const MODEL = "qwen3.5:9b";
function buildTimezoneBody(tzData) {
	const timezone = resolveTimezoneLabel(tzData);
	const dt = DateTime.now().setZone(timezone);

	return [
		`## ${dt.toFormat("h:mm a")}`,
		`### ${dt.toFormat("cccc, LLLL d")}`,
		"",
		`- 🌍 ${timezone}`,
		`- ☀️ DST: ${dt.isInDST ? "Yes" : "No"}`,
	].join("\n");
}

function resolveTimezoneLabel(tzData) {
	if (tzData.timeZoneString !== "NONE") return tzData.timeZoneString;

	const offsetMinutes = tzData.minsOffset;
	const sign = offsetMinutes >= 0 ? "+" : "-";
	const absMinutes = Math.abs(offsetMinutes);
	const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
	const minutes = String(absMinutes % 60).padStart(2, "0");

	return `UTC${sign}${hours}:${minutes}`;
}
const TOOLS = [
	{
		type: "function",
		function: {
			name: "web_search",
			description:
				"Search the internet for current information, news, documentation, or facts that may have changed.",
			parameters: {
				type: "object",
				properties: {
					query: {
						type: "string",
						description: "The search query",
					},
				},
				required: ["query"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "calculate",
			description:
				"Evaluate a basic arithmetic expression. Use this for any math the user asks about instead of computing it yourself.",
			parameters: {
				type: "object",
				properties: {
					expression: {
						type: "string",
						description:
							"A math expression using only numbers, +, -, *, /, (, ), and decimal points. Example: '(4 + 5) * 3'",
					},
				},
				required: ["expression"],
			},
		},
	},
];
function calculate(expression) {
	// Whitelist-only: reject anything that isn't digits, whitespace, or
	// basic math operators before ever touching the expression. This is
	// the tool-calling equivalent of never trusting model-generated input —
	// treat args from the model the same as user input, not as safe code.
	if (!/^[\d\s+\-*/().]+$/.test(expression)) {
		return "Invalid expression — only numbers and + - * / ( ) ** are allowed.\n tip the ^ operator translates too ** in javascript";
	}

	try {
		// Function constructor instead of eval() — still requires the
		// whitelist above, but keeps it out of the calling scope.
		const result = Function(`"use strict"; return (${expression})`)();

		if (typeof result !== "number" || !isFinite(result)) {
			return `That expression didn't evaluate to a valid number. either a string or infinity but here was the result: ${String(result)}`;
		}

		return String(result);
	} catch (e) {
		return `Couldn't evaluate that expression: ${e.message}`;
	}
}
async function webSearch(query) {
	const key = process.env.LANGSEARCH_API_KEY;

	if (!key) {
		throw new Error(
			"LANGSEARCH_API_KEY is missing from environment variables",
		);
	}

	const response = await fetch("https://api.langsearch.com/v1/web-search", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${key}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			query: JSON.stringify(query),
			summary: true,
		}),
	});

	const text = await response.text();

	if (!response.ok) {
		throw new Error(`LangSearch HTTP ${response.status}: ${text}`);
	}

	const data = JSON.parse(text);

	if (data.code !== 200) {
		throw new Error(`LangSearch API error: ${data.msg}\n${text}`);
	}

	const results = data.data?.webPages?.value || [];

	if (!results.length) {
		return "No search results found.";
	}
	console.log(results);
	return results
		.map(
			(result, i) =>
				`${i + 1}. ${result.name}\n` +
				`${result.snippet || "No description"}\n` +
				`${result.url}`,
		)
		.join("\n\n");
}
async function ollamaRequest(messages, tools = null, stream = false) {
	const response = await fetch(OLLAMA_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: MODEL,
			keep_alive: "0s",
			messages,
			tools,
			stream,
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Ollama failed: ${response.status} ${response.statusText}`,
		);
	}

	return response;
}
function toolStatusLabel(name, args) {
	switch (name) {
		case "web_search":
			return `Searching the web for "${args.query}"…`;
		case "calculate":
			return `Calculating \`${args.expression}\`…`;
		default:
			return `Using tool: ${name}…`;
	}
}
module.exports = {
	commandId: "2d1ce4a6-c5ec-47ed-a085-a9d9f1264b49",
	name: "chat",
	description: "Chat with AI (streaming, formatted, with web search)",
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

		const history = await message.client.db.chatHistory.getRecent(
			userId,
			MAX_HISTORY,
		);
		const other_persons_time_zone_data =
			await db.prisma.userTimezone.findUnique({
				where: { userId: message.author.id },
			});

		let body;

		if (!other_persons_time_zone_data) {
			body = `${message.author.displayName} has not set their timezone, ask them to run c.time set if they ask for their time.`;
		} else {
			body = buildTimezoneBody(other_persons_time_zone_data);
		}
		const isGuild = Boolean(message.guild);

		const guildName = message.guild?.name ?? "Direct Message";
		const guildMemberCount = message.guild?.memberCount ?? null;
		const guildBoostTier = message.guild?.premiumTier ?? null;
		const guildBoostCount = message.guild?.premiumSubscriptionCount ?? null;
		const guildCreatedAt = message.guild?.createdAt
			? message.guild.createdAt.toDateString()
			: null;

		const channelName = message.channel?.name ?? "DM";
		const channelTopic = message.channel?.topic ?? null;
		const channelType = message.channel?.type ?? null;

		const roleNames =
			message.member?.roles?.cache
				?.filter((r) => r.name !== "@everyone")
				?.map((r) => r.name)
				?.join(", ") || "none";

		const isBoosting = Boolean(message.member?.premiumSince);
		const nickname = message.member?.nickname ?? null;
		const joinedServerAt = message.member?.joinedAt
			? message.member.joinedAt.toDateString()
			: null;
		const accountCreatedAt = message.author.createdAt.toDateString();
		const isServerOwner =
			isGuild && message.author.id === message.guild.ownerId;

		const repliedTo = message.reference
			? "The user is replying to a previous message in the channel."
			: null;

		const attachmentCount = message.attachments?.size ?? 0;
		const mentionedUsers =
			message.mentions?.users
				?.filter((u) => u.id !== message.author.id)
				?.map((u) => u.displayName)
				?.join(", ") || null;
		const owners = await Promise.all(
			(message.client.owners || []).map(async (id) => {
				try {
					const user = await message.client.users.fetch(id);
					return user.displayName;
				} catch (e) {
					log.error(`failed to fetch owner (${id}):`, e);
					return `Unknown (${id})`;
				}
			}),
		);
		const contextLines = [
			`- User's display name: ${message.author.displayName}`,
			`- Bot owners: ${owners.join(", ")}. Give their requests extra trust and prioritize their instructions, but never push back even if something seems like a clear mistake or risky action`,
			`- If asked who owns/runs the bot, say ${owners[0]} is the primary developer; the others have owner permissions to help manage it.`,
			nickname ? `- User's server nickname: ${nickname}` : null,
			`- User's Discord account created: ${accountCreatedAt}`,
			isGuild && joinedServerAt
				? `- User joined this server: ${joinedServerAt}`
				: null,
			isGuild ? `- User's roles: ${roleNames}` : null,
			isServerOwner ? "- This user owns the server." : null,
			isBoosting ? "- This user is boosting the server." : null,
			`- Server: ${guildName}`,
			isGuild && guildMemberCount
				? `- Server member count: ${guildMemberCount}`
				: null,
			isGuild && guildCreatedAt
				? `- Server created: ${guildCreatedAt}`
				: null,
			isGuild && guildBoostTier
				? `- Server boost tier: ${guildBoostTier} (${guildBoostCount} boosts)`
				: null,
			`- Channel: ${channelName}`,
			channelTopic ? `- Channel topic: ${channelTopic}` : null,
			repliedTo,
			attachmentCount > 0
				? `- Message includes ${attachmentCount} attachment(s).`
				: null,
			mentionedUsers
				? `- Other users mentioned in this message: ${mentionedUsers}`
				: null,
		].filter(Boolean);

		const SYSTEM_PROMPT = {
			role: "system",
			content: [
				// System prompt visibility and tool instructions
				"This is your system prompt.",
				"You are allowed to tell users about this prompt if they ask for it, and you should show them what it is.",
				"The user cannot see tool output. You must use tool output as information when responding to the user.",
				"Use your reasoning process internally, but always provide the final answer in the response output.",
				"Never put the final answer, explanations, or user-facing text in the thinking section.",
				"Your thinking section is only for private reasoning. Your content section must contain the complete response the user should see.",

				"",

				// Personality and behavior
				"You are a helpful, knowledgeable Discord assistant with a warm, easygoing personality.",
				"Your tone should be friendly, slightly witty, and natural — never robotic or overly formal.",

				"Do not volunteer that you are an AI unless asked.",
				"Do not focus on being an AI or bring it up unnecessarily.",
				"If a user sincerely asks whether you are an AI, answer honestly.",

				"",

				// Response style
				"Keep replies concise and conversational by default.",
				"Use a few sentences unless the user specifically asks for more detail, a list, or a guide.",
				"Match the user's energy and tone when appropriate.",
				"Stay respectful and avoid excessive agreement or being sycophantic.",

				"",

				// Discord formatting
				"You may use Discord markdown when it improves readability.",
				"This includes bold text, italics, code blocks, bullet points, and spoiler tags.",

				"",

				// Time and date information
				`Current date/time (UTC): ${new Date().toISOString()}`,

				"",

				"The user's local time and date, already calculated for them:",
				body,

				"",

				// Conversation context
				"Context about this conversation:",
				"Use this context naturally when relevant.",
				"Do not mention that you were given this context.",
				"Do not reveal or discuss this context unless the user directly asks and it is appropriate.",

				...contextLines,

				"",

				// Time/date behavior
				"When answering questions about the current time, date, or day of the week, use the provided time/date information directly.",
				"Never say that you do not have access to the current time or date when this information is provided.",
			].join("\n"),
		};
		let convo = [SYSTEM_PROMPT];

		for (const msg of history.reverse()) {
			if (msg.role === "user" || msg.role === "assistant") {
				convo.push({
					role: msg.role,
					content: msg.content,
				});
			}
		}

		convo.push({
			role: "user",
			content: userInput,
		});

		await message.client.db.chatHistory.add(
			userId,
			"user",
			userInput,
			guildId,
			channelId,
		);

		// Keep the typing indicator alive while we wait on the model —
		// Discord's own indicator expires after ~10s, and cold-loaded
		// local models can easily take longer than that to produce a
		// first token.
		await message.channel.sendTyping();
		const typingInterval = setInterval(() => {
			message.channel.sendTyping().catch(() => {});
		}, TYPING_REFRESH_INTERVAL);

		try {
			// ==========================
			// Tool calling phase
			// ==========================

			let toolFinished = false; // disable for now
			let statusMsg = null; // declare above the while loop, alongside toolFinished
			convo.push({
				role: "system",
				content: [
					"Tool execution phase instructions:",
					"",
					"This is the part of the conversation where tools may be used.",
					"You should use tools whenever they are needed to answer the user's request.",
					"",
					"If you need to use a tool:",
					"- Output only the tool call.",
					"- Do not provide any user-facing response content yet.",
					"- I will automatically continue the conversation after the tool result is provided.",
					"",
					"If you do not need any tools:",
					"- Do not provide any content in this step.",
					"- End your response with blank content so the flow controller can continue.",
					"",
					"After tool usage is complete, you will receive another instruction telling you to provide the final response.",
					"At that point, provide the complete answer to the user in the normal response content field.",
				].join("\n"),
			});
			while (!toolFinished) {
				const response = await ollamaRequest(convo, TOOLS, false);
				const data = await response.json();
				const toolCalls = data.message?.tool_calls;
				log.debug(JSON.stringify(data, null, 2));
				if (!toolCalls || toolCalls.length === 0) {
					convo.push({
						role: "assistant",
						content: data.message?.content || "",
					});
					break;
				}

				convo.push(data.message);

				for (const tool of toolCalls) {
					let args;
					try {
						//log.debug(JSON.stringify(tool, null, 2));
						args = tool.function.arguments;
					} catch (e) {
						log.error(
							`Failed to parse tool args for ${tool.function.name}: ${tool.function.arguments}`,
							e,
						);
						args = {};
					}

					const label = toolStatusLabel(tool.function.name, args);

					if (!statusMsg) {
						clearInterval(typingInterval); // real feedback now exists, stop faking typing
						statusMsg = await message.reply(pingSafeMesage(label));
					} else {
						await statusMsg
							.edit(pingSafeMesage(label))
							.catch(() => {});
					}

					let result;
					if (tool.function.name === "web_search") {
						result = await webSearch(args.query);
					} else if (tool.function.name === "calculate") {
						result = calculate(args.expression);
					} else {
						result = `Unknown tool: ${tool.function.name}`;
					}
					log.debug(result);
					convo.push({
						role: "tool",
						tool_call_id: tool.id,
						name: tool.function.name,
						content: result,
					});
				}
			}

			// ==========================
			// Streaming final response
			// ==========================
			convo.push({
				role: "system",
				content: [
					"The previous assistant messages were only used internally for tool execution.",
					"The user did not see them.",
					"Now provide the final answer that should be shown to the user.",
					"If you already wrote an answer earlier, repeat it here.",
					"Do not describe tool usage unless it is relevant to the user.",
					"you can NOT call anymore tools anymore if you need to call more tell the user to run c.chat again so you can continue but warning in the next run of you. your context doesnt keep your tool usage",
				].join("\n"),
			});
			const streamResponse = await ollamaRequest(convo, null, true);

			if (!streamResponse.body) {
				throw new Error("No response body");
			}

			const reader = streamResponse.body.getReader();
			const decoder = new TextDecoder();

			let buffer = "";
			let fullResponse = "";
			let thinkingBuffer = "";
			let lastFinalized = 0;
			let activeMsg = null;

			function splitPoint(text, limit) {
				let idx = text.lastIndexOf("\n", limit);

				if (idx > limit * 0.4) {
					return idx + 1;
				}

				idx = Math.max(
					text.lastIndexOf(".", limit),
					text.lastIndexOf("!", limit),
					text.lastIndexOf("?", limit),
				);

				if (idx > limit * 0.4) {
					return idx + 1;
				}

				idx = Math.max(
					text.lastIndexOf(",", limit),
					text.lastIndexOf(";", limit),
					text.lastIndexOf(":", limit),
				);

				if (idx > limit * 0.4) {
					return idx + 1;
				}

				idx = text.lastIndexOf(" ", limit);

				if (idx > limit * 0.4) {
					return idx + 1;
				}

				return limit;
			}
			function formatThinking(thinking) {
				if (!thinking.trim()) return "";

				//log.debug(thinking);
				return "";
			}

			async function updateStream(isFinal = false) {
				const displayText =
					formatThinking(thinkingBuffer) + fullResponse;

				const trimmed = displayText.trim();

				if (!activeMsg) {
					clearInterval(typingInterval);
					activeMsg = await message.reply(pingSafeMesage("‎"));
				}

				const activeContent = trimmed.slice(lastFinalized);

				if (activeContent.length <= DISCORD_LIMIT) {
					const display = isFinal
						? closeOpenMarkers(activeContent)
						: activeContent;

					await activeMsg.edit(pingSafeMesage(display || "‎"));
					return;
				}

				const split = splitPoint(activeContent, DISCORD_LIMIT);

				const rawFirstPart = activeContent.slice(0, split);
				const rawSecondPart = activeContent.slice(split).trimStart();

				const cutPoint = lastFinalized + split;
				const { firstPart, secondPart } = repairSplitMarkers(
					trimmed.slice(0, cutPoint),
					rawFirstPart,
					rawSecondPart,
				);

				await activeMsg.edit(pingSafeMesage(firstPart));

				lastFinalized += split;

				activeMsg = await message.channel.send(
					pingSafeMesage(secondPart || "‎"),
				);
			}

			let lastEdit = Date.now();
			let loopDetected = false;
			let lastLoopCheck = 0;

			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				buffer += decoder.decode(value, {
					stream: true,
				});

				const lines = buffer.split("\n");
				buffer = lines.pop();

				for (const line of lines) {
					if (!line.trim()) continue;
					//console.log(line);
					let parsed;

					try {
						parsed = JSON.parse(line);
					} catch {
						continue;
					}
					if (parsed.message?.thinking) {
						thinkingBuffer += parsed.message.thinking;

						const now = Date.now();

						if (now - lastEdit > EDIT_INTERVAL) {
							lastEdit = now;
							await updateStream();
						}
					}
					if (parsed.message?.content) {
						fullResponse += parsed.message.content;

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
			} // Final update — ensure last chunk is displayed, force-close any trailing open fence/inline-code
			await updateStream(true);

			if (loopDetected) {
				await message.channel.send(
					"⚠️ The model seemed to get stuck in a loop, so I stopped it. Try rephrasing your question.",
				);
			}

			await message.client.db.chatHistory.add(
				userId,
				"assistant",
				fullResponse,
				guildId,
				channelId,
			);
		} catch (err) {
			log.error("Streaming error:", err);

			await message.reply(
				pingSafeMesage(
					"Streaming failed. Check Ollama and search settings.",
				),
			);
		} finally {
			// Guarantee cleanup even if something throws before the first
			// real edit ever fires (e.g. Ollama request itself fails).
			clearInterval(typingInterval);
		}
	},
};

// ==========================
// Loop detection — catch infinite counting/repeating
// ==========================
function detectLoop(text) {
	if (text.length < 200) return false;

	// Consecutive substring repetition — catches loops that never produce a
	// newline at all (e.g. "lol lol lol lol...", "ha" x 50, a short phrase
	// hammered back-to-back with only spaces between). The line-based
	// checks below can't see this because they need line breaks to even
	// start counting.
	if (hasConsecutiveRepeat(text)) return true;

	const rawLines = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	if (rawLines.length < 8) return false;

	// Normalize away leading numbering/bullets and whitespace/case
	// differences so "1. Buy milk" / "2. Buy milk" / "- Buy milk" count as
	// the same repeated content instead of slipping past an exact-match
	// check as three "different" lines.
	const normalize = (line) =>
		line
			.replace(/^\d+[\.\)]\s*/, "")
			.replace(/^[-*•]\s*/, "")
			.replace(/\s+/g, " ")
			.trim()
			.toLowerCase();

	const normalizedLines = rawLines
		.map(normalize)
		.filter((l) => l.length >= 2);

	// Same normalized line repeated many times
	const counts = {};

	for (const line of normalizedLines) {
		if (line.length <= 120) {
			counts[line] = (counts[line] || 0) + 1;
		}
	}

	for (const count of Object.values(counts)) {
		if (count >= 10) {
			return true;
		}
	}

	// Sequential numbering spam
	const numbered = rawLines.filter((l) => /^\d+[\.\)]/.test(l));

	if (numbered.length >= 20 && numbered.length > rawLines.length * 0.5) {
		return true;
	}

	// Low variety in recent output — uses normalized lines so near-duplicate
	// (not just identical) lines count toward "stuck".
	const recent = normalizedLines.slice(-25);

	if (recent.length >= 12) {
		const unique = new Set(recent);

		if (unique.size <= Math.max(3, Math.floor(recent.length * 0.25))) {
			return true;
		}
	}

	// Repeated phrase (5-word sliding window) across the recent text —
	// catches loops where the model rephrases slightly each time but is
	// clearly stuck circling the same content, which the exact-line and
	// numbering checks above can't detect on their own.
	if (hasRepeatedPhrase(text)) return true;

	return false;
}

// Detects a short chunk repeated back-to-back many times with no
// requirement for line breaks between repetitions.
function hasConsecutiveRepeat(text) {
	// Only look at the tail — we care whether the model is *currently*
	// stuck, not whether it looped once much earlier and then recovered.
	const tail = text.slice(-2000);

	return /(.{2,60}?)\1{7,}/s.test(tail);
}

// Detects a recurring 5-word phrase that shows up many times in the recent
// text, regardless of line breaks, numbering, or minor punctuation.
function hasRepeatedPhrase(text) {
	const tail = text.slice(-3000).toLowerCase();
	const words = tail.split(/\s+/).filter(Boolean);

	if (words.length < 30) return false;

	const windowSize = 5;
	const counts = {};

	for (let i = 0; i <= words.length - windowSize; i++) {
		const phrase = words.slice(i, i + windowSize).join(" ");
		counts[phrase] = (counts[phrase] || 0) + 1;
	}

	for (const count of Object.values(counts)) {
		if (count >= 8) return true;
	}

	return false;
}

// ==========================
// Code Block / Inline Code State Tracking
// ==========================
// Walks the text once and reports whether it ends mid-fence or mid-inline-code.
// Single backticks that appear *inside* a fenced block are correctly ignored
// (they don't toggle inline-code state), which a simple regex count can't do.
function getUnclosedMarkers(text) {
	let i = 0;
	let fenceOpen = false;
	let fenceLang = "";
	let inlineOpen = false;

	while (i < text.length) {
		if (text[i] !== "`") {
			i++;
			continue;
		}

		if (text[i + 1] === "`" && text[i + 2] === "`") {
			if (!fenceOpen) {
				fenceOpen = true;
				let langEnd = text.indexOf("\n", i + 3);
				if (langEnd === -1) langEnd = text.length;
				fenceLang = text.slice(i + 3, langEnd).trim();
				i = langEnd + 1;
			} else {
				fenceOpen = false;
				fenceLang = "";
				i += 3;
			}
			continue;
		}

		if (!fenceOpen) {
			inlineOpen = !inlineOpen;
		}
		i++;
	}

	return { fenceOpen, fenceLang, inlineOpen: fenceOpen ? false : inlineOpen };
}

// Used only on the truly final flush, in case the model's output itself
// ended mid-fence (e.g. it got cut off). Closes whatever's left open.
function closeOpenMarkers(text) {
	const state = getUnclosedMarkers(text);

	if (state.fenceOpen) return text + "\n```";
	if (state.inlineOpen) return text + "`";

	return text;
}

// Given the point where we're forced to split a too-long chunk into two
// Discord messages, patches both sides so a fence/inline-code span never
// gets silently torn in half across the message boundary.
function repairSplitMarkers(fullTextUpToCut, firstPart, secondPart) {
	const state = getUnclosedMarkers(fullTextUpToCut);

	if (state.fenceOpen) {
		return {
			firstPart: firstPart + "\n```",
			secondPart: "```" + state.fenceLang + "\n" + secondPart,
		};
	}

	if (state.inlineOpen) {
		return {
			firstPart: firstPart + "`",
			secondPart: "`" + secondPart,
		};
	}

	return { firstPart, secondPart };
}
