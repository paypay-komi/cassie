const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../lib/logger");
const { pingSafeMesage } = require("../../utils/safeMsg");
const { ArgsBuilder } = require("../../lib/argsBuilder");
const db = require("../../db");
const { DateTime } = require("luxon");
const restart = require("./ownerCommands/restart");
const serverExplorer = require("../../lib/serverExplorer");
const MAX_HISTORY = 20;
const EDIT_INTERVAL = 1000;
const DISCORD_LIMIT = 2000;
const TYPING_REFRESH_INTERVAL = 8000; // Discord's typing indicator expires after ~10s
const MEMORY_WORD_LIMIT = 1000;

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
	{
		type: "function",
		function: {
			name: "get_user_stats",
			description:
				"Look up a user's activity stats in this server: message count, voice time, days in server. Use when someone asks how active they or someone else is.",
			parameters: {
				type: "object",
				properties: {
					user_id: {
						type: "string",
						description: "The Discord user ID to look up",
					},
				},
				required: ["user_id"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_server_stats",
			description:
				"Get aggregate stats for this server: total members, humans, bots, boosts, channels, emojis, roles. Use when someone asks about the server.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_role_requirements",
			description:
				"List all auto-role requirement expressions configured for this server. Use when someone asks what they need for a role or how the auto-role system works.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_tags",
			description:
				"List all tags in this server. Use when someone asks what tags exist or wants to see available tags.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_echo_channels",
			description:
				"List all echo chamber channels configured in this server. Use when someone asks about echo channels.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "get_economy_balance",
			description:
				"Check a user's economy balance in this server. Use when someone asks about their coins or balance.",
			parameters: {
				type: "object",
				properties: {
					user_id: {
						type: "string",
						description: "The Discord user ID to check (defaults to the requesting user)",
					},
				},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "read_memory",
			description:
				"Read the AI's persistent memory about this user. The memory stores important facts, preferences, and context across conversations. Use at the start of a conversation to recall what you know about the user.",
			parameters: {
				type: "object",
				properties: {},
			},
		},
	},
	{
		type: "function",
		function: {
			name: "write_memory",
			description:
				"Completely replace the AI's persistent memory about this user. Use when the user asks you to remember something new, update your notes about them, or when you learn something important worth preserving. Keep it concise — limit to ~1000 words.",
			parameters: {
				type: "object",
				properties: {
					memory: {
						type: "string",
						description: "The new memory content to store. Use clear, organized text with bullet points or sections.",
					},
				},
				required: ["memory"],
			},
		},
	},
	{
		type: "function",
		function: {
			name: "append_memory",
			description:
				"Add new information to the end of the existing memory. Use when you learn something new about the user that's worth remembering but the existing memory is still valid.",
			parameters: {
				type: "object",
				properties: {
					note: {
						type: "string",
						description: "The new note to append to memory.",
					},
				},
				required: ["note"],
			},
		},
	},
	...serverExplorer.TOOLS,
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
		case "get_user_stats":
			return `Looking up stats for user ${args.user_id}…`;
		case "get_server_stats":
			return `Fetching server stats…`;
		case "get_role_requirements":
			return `Looking up role requirements…`;
		case "get_tags":
			return `Fetching tags…`;
		case "get_echo_channels":
			return `Fetching echo channels…`;
		case "get_economy_balance":
			return `Checking balance for ${args?.user_id || "you"}…`;
		case "read_memory":
			return `Reading memory…`;
		case "write_memory":
			return `Saving to memory…`;
		case "append_memory":
			return `Appending to memory…`;
		default:
			return `Using tool: ${name}…`;
	}
}

async function handleTool(toolName, args, message) {
	const guild = message.guild;
	const db = message.client.db;

	switch (toolName) {
		case "calculate":
			return calculate(args.expression);

		case "web_search":
			return await webSearch(args.query);

		case "get_user_stats": {
			if (!guild) return "This tool only works in servers.";
			const uid = args.user_id;
			const member = await guild.members.fetch(uid).catch(() => null);
			if (!member) return "User not found in this server.";
			const activity = await db.prisma.guildMemberActivity.findUnique({
				where: { guildId_userId: { guildId: guild.id, userId: uid } },
			}).catch(() => null);
			const msgCount = activity?.messageCount ?? 0;
			const voiceSec = activity?.voiceSeconds ?? 0;
			const days = Math.floor((Date.now() - (member.joinedAt?.getTime() || Date.now())) / 86400000);
			const roles = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.name).join(", ") || "none";
			const h = Math.floor(voiceSec / 3600);
			const m = Math.floor((voiceSec % 3600) / 60);
			const voiceStr = voiceSec >= 3600 ? `${h}h ${m}m` : `${m}m`;
			return [
				`User: ${member.user.username} (${uid})`,
				`Messages: ${msgCount.toLocaleString()}`,
				`Voice time: ${voiceStr}`,
				`Days in server: ${days}`,
				`Roles: ${roles}`,
				`Boosting: ${member.premiumSince ? "Yes" : "No"}`,
			].join("\n");
		}

		case "get_server_stats": {
			if (!guild) return "This tool only works in servers.";
			const total = guild.memberCount;
			const humans = guild.members.cache.filter((m) => !m.user.bot).size;
			const bots = guild.members.cache.filter((m) => m.user.bot).size;
			const boostCount = guild.premiumSubscriptionCount || 0;
			const boostTier = guild.premiumTier || 0;
			const textCh = guild.channels.cache.filter((c) => c.type === 0).size;
			const voiceCh = guild.channels.cache.filter((c) => c.type === 2).size;
			const emojis = guild.emojis.cache.size;
			const roles = guild.roles.cache.size - 1;
			return [
				`Server: ${guild.name}`,
				`Members: ${total} (${humans} humans, ${bots} bots)`,
				`Roles: ${roles}`,
				`Channels: ${textCh} text, ${voiceCh} voice`,
				`Emojis: ${emojis}`,
				`Boosts: ${boostCount} (Tier ${boostTier})`,
			].join("\n");
		}

		case "get_role_requirements": {
			if (!guild) return "This tool only works in servers.";
			const reqs = await db.prisma.guildMemberRoleRequirement.findMany({
				where: { guildId: guild.id },
				orderBy: { createdAt: "asc" },
			}).catch(() => []);
			if (!reqs.length) return "No auto-role requirements configured in this server.";
			const lines = reqs.map((r) => {
				const role = guild.roles.cache.get(r.roleId);
				const name = role ? role.name : `Role ${r.roleId}`;
				return `${name}: \`${r.expression}\``;
			});
			return [`Auto-role requirements (${reqs.length}):`, ...lines].join("\n");
		}

		case "get_tags": {
			if (!guild) return "This tool only works in servers.";
			const tags = await db.prisma.guildTag.findMany({
				where: { guildId: guild.id },
				orderBy: { uses: "desc" },
			}).catch(() => []);
			if (!tags.length) return "No tags in this server.";
			const lines = tags.map((t) => `\`${t.name}\` — ${t.uses} uses`);
			return [`Tags (${tags.length}):`, ...lines].join("\n");
		}

		case "get_echo_channels": {
			if (!guild) return "This tool only works in servers.";
			const echos = await db.prisma.echoChannel.findMany({
				where: { guildId: guild.id },
			}).catch(() => []);
			if (!echos.length) return "No echo channels configured.";
			const lines = echos.map((e) => {
				const ch = guild.channels.cache.get(e.channelId);
				const name = ch ? `#${ch.name}` : `Channel ${e.channelId}`;
				const chance = e.echoChance ? `${Math.round(e.echoChance)}%` : "default";
				return `${name} (${chance})`;
			});
			return [`Echo channels (${echos.length}):`, ...lines].join("\n");
		}

		case "get_economy_balance": {
			if (!guild) return "This tool only works in servers.";
			const uid = args.user_id || message.author.id;
			const econ = await db.prisma.guildEconomy.findUnique({
				where: { guildId: guild.id },
			}).catch(() => null);
			if (!econ || !econ.enabled) return "Economy is not enabled in this server.";
			const userEcon = await db.prisma.guildEconomyUser.findUnique({
				where: { guildId_userId: { guildId: guild.id, userId: uid } },
			}).catch(() => null);
			if (!userEcon) return `${uid === message.author.id ? "You don't" : "That user doesn't"} have an economy account yet.`;
			return [
				`${econ.currencySymbol} **${econ.currencyName}**`,
				`Balance: ${userEcon.balance.toLocaleString()} ${econ.currencySymbol}`,
				`Total earned: ${userEcon.totalEarned.toLocaleString()} ${econ.currencySymbol}`,
				`Work streak: ${userEcon.workStreak}`,
			].join("\n");
		}

		case "read_memory": {
			const mem = await db.prisma.chatMemory.findUnique({
				where: { userId: message.author.id },
			}).catch(() => null);
			return mem?.memory?.trim() || "(No memory stored yet)";
		}

		case "write_memory": {
			const wordCount = args.memory.split(/\s+/).filter(Boolean).length;
			if (wordCount > MEMORY_WORD_LIMIT) {
				return `Memory too long (${wordCount} words). Please keep it under ${MEMORY_WORD_LIMIT} words.`;
			}
			await db.prisma.chatMemory.upsert({
				where: { userId: message.author.id },
				update: { memory: args.memory },
				create: { userId: message.author.id, memory: args.memory },
			}).catch(() => null);
			return `Memory saved (${wordCount} words).`;
		}

		case "append_memory": {
			const existing = await db.prisma.chatMemory.findUnique({
				where: { userId: message.author.id },
			}).catch(() => null);
			const current = existing?.memory || "";
			const updated = current ? `${current}\n${args.note}` : args.note;
			const wordCount = updated.split(/\s+/).filter(Boolean).length;
			if (wordCount > MEMORY_WORD_LIMIT) {
				return `Appending would exceed ${MEMORY_WORD_LIMIT} words (${wordCount}). Use write_memory to replace instead, or make the note shorter.`;
			}
			await db.prisma.chatMemory.upsert({
				where: { userId: message.author.id },
				update: { memory: updated },
				create: { userId: message.author.id, memory: updated },
			}).catch(() => null);
			return `Appended to memory (${wordCount} words total).`;
		}

		default: {
			const seResult = await serverExplorer.handleTool(toolName, args, message);
			if (seResult !== null) return seResult;
			return `Unknown tool: ${toolName}`;
		}
	}
}
module.exports = {
	commandId: "2d1ce4a6-c5ec-47ed-a085-a9d9f1264b49",
	name: "chat",
	description: "Chat with AI (streaming, formatted, with web search).",
	category: {
		name: "AI",
		emoji: "🧠",
		description: "AI-powered and chat commands.",
		order: 45,
	},
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

		// Load user's persistent memory
		const userMemory = await db.prisma.chatMemory.findUnique({
			where: { userId: message.author.id },
		}).catch(() => null);
		const memoryText = userMemory?.memory?.trim() || "(No memory stored yet)";

		let body;

		if (!other_persons_time_zone_data) {
			body = `${message.author.displayName} has not set their timezone, ask them to run c.time set if they ask for their time.`;
		} else {
			body = buildTimezoneBody(other_persons_time_zone_data);
		}
		const isGuild = Boolean(message.guild);
		const guild = message.guild;

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
			`- User's Discord ID: ${message.author.id}`,
			isGuild ? `- Server ID: ${guild.id}` : null,
			`- Channel ID: ${channelId}`,
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
				"## Your persistent memory about this user:",
				memoryText,
				"When the user says something worth remembering (preferences, facts about them, important context), use the write_memory or append_memory tool to save it. Do this proactively — don't wait to be asked.",
				"Read your memory at the start of each conversation to recall what you know.",

				"",
				"## Tool usage tips:",
				"You have the user's ID, server ID, and channel ID in the context above. Use them directly when calling tools — don't ask the user for their ID.",
				"When the user says 'my stats' or 'how active am I', call get_user_stats with their ID from context.",
				"When the user says 'server stats' or 'this server', call get_server_stats.",
				"When the user mentions another user by name or ID, you can look them up with get_user_stats if you have their ID.",
				"",

				// Personality and behavior
				"You are Cassie, a helpful, knowledgeable Discord assistant with a warm, easygoing personality.",
				"Your tone should be friendly, slightly witty, and natural — never robotic or overly formal.",
				"",
				"Do not claim you don't know how you work, what you can do, or what your capabilities are. You have tools, memory, and a system prompt — you know exactly what you are.",
				"If someone asks how you work, be honest: you're an AI running on Ollama with tool access, persistent memory, and Discord integration. Your owners built you and know exactly how you work — don't pretend otherwise or make up excuses.",
				"Do not say 'I'm just an AI' or 'I can't do that' without actually checking your tools first. You have web search, math, server data, user stats, memory, and more.",
				"Do not hallucinate capabilities you don't have. If a tool doesn't exist for something, say so honestly.",
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

				"",

				// Requirement expression helper
				"You can help users create expressions for the bot's role requirement system when they ask.",
				"The requirement system is a separate deterministic system. You only help users understand and construct expressions; you do not enforce or execute them.",

				"Supported metrics:",
				"- messageCount: total messages sent by the member.",
				"- voiceSeconds: total time spent in voice channels, measured in seconds.",
				"- daysInServer: number of days since the member joined the server.",

				"Supported comparison operators:",
				"- >= (greater than or equal to)",
				"- <= (less than or equal to)",
				"- > (greater than)",
				"- < (less than)",
				"- == (equal to)",

				"Supported logical operators:",
				"- AND",
				"- OR",

				"Parentheses are supported and can be used to control grouping.",

				"Examples:",
				"- messageCount >= 100",
				"- messageCount >= 100 AND voiceSeconds >= 3600",
				"- messageCount >= 100 OR daysInServer >= 7",
				"- messageCount >= 100 AND (voiceSeconds >= 3600 OR daysInServer >= 7)",
				"- (messageCount >= 100 AND voiceSeconds >= 3600) OR daysInServer >= 30",

				"When helping a user create an expression:",
				"- Translate their natural-language requirements into the supported expression syntax.",
				"- Do not invent metrics or operators that are not listed above.",
				"- Convert time into seconds when using voiceSeconds. For example, 2 hours = 7200 seconds.",
				"- Explain what the resulting expression means if useful.",
				"- If the user's request is ambiguous, ask what they mean rather than guessing.",
				"- Remember that AND requires all conditions to be true, while OR requires at least one condition to be true.",
				"- When a user uses vague terms such as 'active', 'loyal', 'regular', or 'trusted', do not invent a definition. Ask them which measurable requirements they want.",
				"- When explaining an expression, accurately describe the logical structure. Pay special attention to AND/OR combinations and do not claim that satisfying an OR branch is sufficient if that branch is itself part of an AND requirement.",

				"",

				// Server inspection tools
				"You have access to server inspection tools that let you learn about and answer questions about the Discord server you are currently in.",
				"ALL inspection tools are guild-scoped and read-only. They will not work in DMs.",

				"Tool categories:",
				"- get_server_data: Full server overview (name, owner, boosts, features, etc.)",
				"- Members: get_members, get_member_names, get_member_ids, search_members, get_member_data, get_member_roles, get_member_permissions",
				"- Roles: get_roles, get_role_names, get_role_ids, search_roles, get_role_data, get_role_members",
				"- Channels: get_channels, get_channel_names, get_channel_ids, search_channels, get_channel_data, get_channel_permissions, get_channel_members",
				"- Categories: get_categories, get_category_names, get_category_ids, search_categories, get_category_data, get_category_channels",
				"- Threads: get_threads, search_threads, get_thread_data, get_thread_members",
				"- Messages: get_message, get_recent_messages, search_messages",
				"- Emojis: get_emojis, get_emoji_names, get_emoji_ids, search_emojis, get_emoji_data",
				"- Stickers: get_stickers, get_sticker_names, get_sticker_ids, search_stickers, get_sticker_data",

				"Core rule: never invent server information.",
				"The AI must clearly distinguish between: facts directly returned by tools, reasonable interpretations, and information that is unknown.",
				"Only state something as a fact if the inspection tools actually returned that information.",
				"For example, if #general exists, the AI may say: '#general is a text channel.' It may NOT automatically say: '#general is where everyone hangs out.' The channel name alone is not enough to establish its purpose.",
				"If something is an interpretation, explicitly make that clear: 'The name #general suggests it may be intended for general discussion, but the channel metadata doesn't confirm its purpose.'",
				"If the information cannot be determined from the available tools, say that it cannot be determined instead of guessing.",

				"Tool usage:",
				"Use the inspection tools whenever the user asks about the server, its configuration, members, roles, channels, permissions, or other server data.",
				"Use the smallest appropriate tool first.",
				"- Asking about a specific channel → get that channel's data",
				"- Asking for channel names/IDs → get channel data/list",
				"- Asking about a specific role → get role data",
				"- Asking about a member → get member data",
				"- Asking about permissions → retrieve the relevant permission/channel/role data needed to determine them",
				"- Asking about multiple things → use the appropriate tools for each thing",
				"- Asking something broad about the server → progressively inspect the relevant data rather than assuming everything",
				"Do NOT fetch every piece of server data just because the user asks a broad question. Use pagination where the tools support it.",
				"The AI should be capable of progressively learning about the server by calling additional tools when the information it currently has is insufficient.",

				"Never infer permissions incorrectly:",
				"Having a role does NOT automatically mean a member can access something.",
				"For example, do not say: 'You have the 18+ role, so you can access this NSFW channel.' Instead, inspect the relevant permissions/channel overwrites if access is being asked about.",
				"Similarly:",
				"- A role existing does not mean it is assigned to the user.",
				"- A channel being NSFW does not mean everyone can access it.",
				"- A channel having slowmode 0 does not mean spam is allowed.",
				"- A channel being named general does not prove what people use it for.",
				"- A channel being recently created does not prove it is active.",
				"- A recent last-message timestamp does not prove that it is currently active.",
				"- A role name does not prove what that role is actually used for.",

				"Be precise with retrieved data:",
				"When the tool provides exact values, prefer those exact values.",
				"- Give the actual channel type, category, position, NSFW value, slowmode value, topic, creation timestamp/date, last-message timestamp if available, and IDs when requested.",
				"Do not replace exact information with vague wording such as 'recent!' when the actual timestamp is available.",

				"Don't add unsupported advice:",
				"The AI should not turn raw server information into unnecessary advice.",
				"For example, don't automatically add tips for using #general unless the tool data actually supports those statements.",
				"The purpose of the inspection system is to tell the user what is actually configured in the server, not to roleplay as a server guide.",

				"Server scope:",
				"Inspection must stay scoped to the Discord server where the AI is currently being used.",
				"Do not use information from other Discord servers.",
				"Do not assume information from Discord's defaults applies to this server if the tools can retrieve the actual server configuration.",

				"Pagination:",
				"When an inspection tool returns paginated data, respect the pagination mechanism. Do not pretend the first page is the complete server.",
				"If the user's question requires more results, continue fetching pages.",
				"If the user asks for a complete list, continue until all relevant pages have been retrieved, unless there is a tool/system limit.",
				"If only a portion was retrieved, make that clear.",
				"Do not dump enormous amounts of raw data into the response when a concise answer is sufficient.",

				"Tool result limitations:",
				"If a tool only returns partial information, don't fill in the missing fields from assumptions.",
				"For example, if role data returns name, id, and color but does not return what the role is used for, do not invent a purpose for the role. Say: 'The role is named Moderator, but the available role data doesn't show what it is intended for.'",

				"Combining tools:",
				"The AI should be able to combine information from multiple tools when necessary.",
				"For example, if asked 'Can the member @X access #general?', the AI may need to inspect: the member's roles, the channel's permission overwrites, relevant role permissions, and the server's permission structure, then reason from the retrieved data.",
				"Do not answer based on only the member's role name.",

				"Response style:",
				"Keep responses natural and readable.",
				"For simple questions, give a simple answer.",
				"For detailed inspection requests, organize information into sections or tables when useful.",
				"Do not add unnecessary emojis, fake enthusiasm, or generic filler.",
				"The AI should sound like a knowledgeable Discord server inspection assistant, not like it is trying to entertain the user.",

				"Important distinction:",
				"The AI is allowed to reason from retrieved data. It is NOT allowed to turn assumptions into facts.",
				"For example, if retrieved data shows Channel name: general, Type: text, NSFW: true, Slowmode: 0:",
				"- Valid: '#general is a text channel marked NSFW with slowmode disabled.'",
				"- Valid interpretation: 'Since it's named general, it may be intended for general discussion, although the metadata doesn't confirm that.'",
				"- Invalid: 'This is the main chat hub where everyone hangs out and general announcements happen.' — the last statement contains information that was never retrieved.",

				"Main objective:",
				"Make the inspection AI extremely useful for discovering the server while keeping it grounded in actual tool data.",
				"It should be able to answer questions such as: What channels are in this server? What roles exist? What is this channel configured like? Who is this member? What roles does this member have? What permissions does this role have? Can this member access this channel? What categories exist? What channels are inside a category? What is the server configured to allow? What information can be determined about this server?",
				"When the answer requires information it hasn't retrieved yet, use the appropriate inspection tool rather than guessing.",
				"The AI should treat the inspection tools as its source of truth for server-specific information.",

				"Pagination helpers: Most list tools support 'page' (default 1) and 'limit' (default 25, max 100). Results include total, totalPages, and hasMore.",
				"Search tools use case-insensitive substring matching on names.",
				"Message tools: get_message fetches by channel+message ID. get_recent_messages supports before/after cursor pagination. search_messages scans up to ~500 recent messages.",
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
		let spinnerTimer = null; // hoisted so `finally` can always clear it

		try {
			// ==========================
			// Unified streaming loop — tool calls and the final answer all
			// stream into ONE message. Every round (tool round or answer
			// round) is a streamed Ollama request; we just read each round
			// differently depending on whether it comes back with
			// tool_calls or with real content.
			// ==========================
			convo.push({
				role: "system",
				content: [
					"Tool + response flow:",
					"",
					"You may call tools whenever they would help answer the user's request.",
					"Available tools: web_search, calculate, get_user_stats, get_server_stats, get_role_requirements, get_tags, get_echo_channels, get_economy_balance, read_memory, write_memory, append_memory.",
					"If you call a tool, leave your visible content empty for that turn — the tool result will be added to the conversation and you will get another turn.",
					"You may call tools across multiple turns in a row if needed.",
					"Once you don't need any more tools, write your complete, final answer as normal visible content — this is what the user will see.",
					"Do not describe tool usage unless it's relevant to the user.",
					"Proactively save important facts about the user to memory using write_memory or append_memory when you learn something worth preserving.",
				].join("\n"),
			});

			const decoder = new TextDecoder();

			let fullResponse = "";
			let thinkingBuffer = "";
			let lastFinalized = 0;
			let activeMsg = null;
			let loopDetected = false;

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
				const trimmed = thinking.trim();

				if (!trimmed) return "";

				return `# Thinking\n\n${trimmed}`;
			}

			// Renders thinking tokens into their own message, headed by
			// "# Thinking". Kept separate from updateStream() below —
			// once real content or a tool call shows up, we stop touching
			// this message (it's left in place as a record of the
			// reasoning) and a brand new message is used for the outcome.
			async function updateThinkingMsg() {
				if (!activeMsg) {
					clearInterval(typingInterval);
					activeMsg = await message.reply(
						pingSafeMesage("# Thinking"),
					);
				}

				const text = formatThinking(thinkingBuffer);

				// Thinking can run long; unlike the final answer we don't
				// need perfect mid-word splitting across messages here —
				// just keep the heading and show the most recent portion.
				const display =
					text.length > DISCORD_LIMIT
						? `# Thinking\n\n…${text.slice(-(DISCORD_LIMIT - 20))}`
						: text;

				await activeMsg.edit(pingSafeMesage(display)).catch(() => {});
			}

			async function updateStream(isFinal = false) {
				const displayText = fullResponse;

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

			// "Thinking…" spinner — covers the dead air while Ollama is
			// starting up / generating first token(s) for a round. It owns
			// activeMsg (and edits it directly) until real content starts
			// arriving, at which point updateStream() takes over the same
			// message. Also used as the resting state between rounds
			// (e.g. right after a tool result is fed back in).
			const SPINNER_FRAMES = [
				"Thinking.",
				"Thinking..",
				"Thinking...",
				"Thinking",
			];
			const SPINNER_INTERVAL = 1000;
			let spinnerFrame = 0;

			async function startSpinner() {
				if (!activeMsg) {
					clearInterval(typingInterval);
					activeMsg = await message.reply(
						pingSafeMesage(SPINNER_FRAMES[0]),
					);
				}

				if (spinnerTimer) return;

				spinnerTimer = setInterval(() => {
					spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
					activeMsg
						.edit(pingSafeMesage(SPINNER_FRAMES[spinnerFrame]))
						.catch(() => {});
				}, SPINNER_INTERVAL);
			}

			function stopSpinner() {
				if (spinnerTimer) {
					clearInterval(spinnerTimer);
					spinnerTimer = null;
				}
			}

			// Caps so a misbehaving model can't loop forever: at most this
			// many tool-calling rounds before we force a final answer, and
			// at most this many retries of a round that comes back totally
			// empty (no content, no tool call).
			const MAX_TOOL_ROUNDS = 6;
			const MAX_EMPTY_RETRIES = 2;

			let toolRoundsUsed = 0;
			let emptyRetries = 0;
			let toolsExhaustedNoticeSent = false;
			let lastToolRoundContent = ""; // fallback if the final round ends up empty

			let finalDone = false;

			while (!finalDone) {
				let buffer = "";
				thinkingBuffer = "";
				fullResponse = "";
				lastFinalized = 0;
				loopDetected = false;
				let thinkingDetached = false; // has this round's thinking message already been "handed off" to a fresh outcome message?

				const toolsCapped = toolRoundsUsed >= MAX_TOOL_ROUNDS;

				if (toolsCapped && !toolsExhaustedNoticeSent) {
					toolsExhaustedNoticeSent = true;
					convo.push({
						role: "system",
						content:
							"You've used the maximum number of tool calls for this turn. Tools are now disabled — answer now using only what you already have.",
					});
				}

				await startSpinner();

				const streamResponse = await ollamaRequest(
					convo,
					toolsCapped ? null : TOOLS,
					true,
				);

				if (!streamResponse.body) {
					throw new Error("No response body");
				}

				const reader = streamResponse.body.getReader();

				let lastEdit = Date.now();
				let lastLoopCheck = 0;
				let roundToolCalls = null;
				let roundAssistantMessage = null;

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

						if (parsed.message?.tool_calls?.length) {
							roundToolCalls = parsed.message.tool_calls;
							roundAssistantMessage = parsed.message;
						}

						if (parsed.message?.thinking) {
							// Stream the model's reasoning into its own
							// "# Thinking" message — separate from
							// whatever ends up being the round's outcome
							// (tool status or real content).
							stopSpinner();

							thinkingBuffer += parsed.message.thinking;

							const now = Date.now();

							if (now - lastEdit > EDIT_INTERVAL) {
								lastEdit = now;
								await updateThinkingMsg();
							}
						}

						if (parsed.message?.content) {
							// Real content is arriving now. If a thinking
							// message was showing, leave it in place and
							// start a brand new message for the answer —
							// don't overwrite the reasoning with it.
							if (!thinkingDetached && thinkingBuffer.trim()) {
								thinkingDetached = true;
								activeMsg = null;
								lastFinalized = 0;
							}

							stopSpinner();

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
				}

				if (loopDetected) break;

				if (roundToolCalls && roundToolCalls.length) {
					// This round called tool(s) instead of (or alongside)
					// answering — run them, feed results back, and loop
					// around for another round on the same message.
					stopSpinner();

					// If a thinking message was showing, leave it in place
					// and let the tool-status labels below start a fresh
					// message of their own.
					if (!thinkingDetached && thinkingBuffer.trim()) {
						thinkingDetached = true;
						activeMsg = null;
					}

					if (fullResponse.trim()) {
						lastToolRoundContent = fullResponse;
					}

					convo.push(
						roundAssistantMessage || {
							role: "assistant",
							content: fullResponse,
							tool_calls: roundToolCalls,
						},
					);

					for (const tool of roundToolCalls) {
						let args;

						try {
							args = tool.function.arguments;
						} catch (e) {
							log.error(
								`Failed to parse tool args for ${tool.function.name}: ${tool.function.arguments}`,
								e,
							);
							args = {};
						}

						const label = toolStatusLabel(tool.function.name, args);

						if (!activeMsg) {
							clearInterval(typingInterval);
							activeMsg = await message.reply(
								pingSafeMesage(label),
							);
						} else {
							await activeMsg
								.edit(pingSafeMesage(label))
								.catch(() => {});
						}

						let result;

						try {
							result = await handleTool(tool.function.name, args, message);
						} catch (e) {
							result = `Tool error: ${e.message}`;
						}

						log.debug(result);
						convo.push({
							role: "tool",
							tool_call_id: tool.id,
							name: tool.function.name,
							content: result,
						});
					}

					toolRoundsUsed++;

					// Leave this round's message as-is (showing the last
					// tool status) instead of reusing it — the next round
					// (another tool call or the final answer) gets its own
					// fresh "Thinking…" message.
					activeMsg = null;

					continue;
				}

				// No tool calls this round — this was meant to be the
				// final answer.
				if (fullResponse.trim()) {
					finalDone = true;
					break;
				}

				// Empty round, no tool call. Retry a few times before
				// giving up — silently, without asking the user to run
				// anything themselves.
				if (emptyRetries < MAX_EMPTY_RETRIES) {
					emptyRetries++;
					log.warn(
						`Empty final response on retry ${emptyRetries}/${MAX_EMPTY_RETRIES}, auto-retrying...`,
					);
					continue;
				}

				break;
			}

			stopSpinner();

			// If the model still produced nothing after retries, fall back
			// to the last tool round's content (if it had already written
			// something), otherwise apologize — without asking the user to
			// manually rerun anything.
			if (!fullResponse.trim()) {
				if (lastToolRoundContent.trim()) {
					fullResponse = lastToolRoundContent;
					await updateStream(true);
				} else if (activeMsg) {
					await activeMsg.edit(
						pingSafeMesage(
							"Sorry, I couldn't get a response together for that one.",
						),
					);
				} else {
					clearInterval(typingInterval);
					await message.reply(
						pingSafeMesage(
							"Sorry, I couldn't get a response together for that one.",
						),
					);
				}
			} else {
				// Final update — ensure last chunk is displayed, force-close any trailing open fence/inline-code
				await updateStream(true);
			}

			if (loopDetected) {
				await message.channel.send(
					"⚠️ The model seemed to get stuck in a loop, so I stopped it. Try rephrasing your question.",
				);
			}

			if (fullResponse.trim()) {
				await message.client.db.chatHistory.add(
					userId,
					"assistant",
					fullResponse,
					guildId,
					channelId,
				);
			}
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
			clearInterval(spinnerTimer);
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
