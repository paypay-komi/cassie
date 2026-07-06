const { PermissionsBitField, Message } = require("discord.js");

const { VM } = require("vm2");
const util = require("util");
const db = require("../../../db");

/* ---------------- TOKEN CENSOR ---------------- */
function censor(value) {
	if (typeof value !== "string") return value;

	const discordTokenPattern = /[\w-]{24}\.[\w-]{6,}\.[\w-]{25,}/g;

	const secretPattern =
		/\b(token|api[_-]?key|apikey|auth|password|secret|key|pass)\b\s*[:=]\s*['"`]?([\w\-\.]{16,})['"`]?/gi;

	return value
		.replace(discordTokenPattern, (match) => {
			return match.slice(0, 10) + "...[REDACTED_DISCORD_TOKEN]";
		})
		.replace(secretPattern, () => "[REDACTED_SECRET]");
}

/* ---------------- CODE DETECTION ---------------- */
function isCodeBlock(input) {
	if (typeof input !== "string") return false;

	return /^\s*(const|let|var|function|class|if|for|while|switch|try|import|export)\b/m.test(
		input,
	);
}

/* ---------------- SAFE INSPECT ---------------- */
function safeWalk(obj, seen = new WeakSet(), depth = 0, maxDepth = 5) {
	if (obj === null || typeof obj !== "object") return obj;
	if (typeof obj === "function") return "[Function]";

	if (seen.has(obj)) return "[Circular]";
	seen.add(obj);

	if (depth > maxDepth) return "[MaxDepth]";

	const out = Array.isArray(obj) ? [] : {};

	for (const key of Object.keys(obj)) {
		try {
			const val = obj[key];

			if (typeof val === "object") {
				out[key] = safeWalk(val, seen, depth + 1, maxDepth);
			} else if (typeof val === "function") {
				out[key] = "[Function]";
			} else {
				out[key] = val;
			}
		} catch {
			out[key] = "[Uninspectable]";
		}
	}

	return out;
}

/* ---------------- SANDBOX ---------------- */
function createSandbox(message) {
	return {
		client: message.client,
		message,
		channel: message.channel,
		guild: message.guild,
		user: message.author,

		Buffer,
		console,
		setTimeout,
		clearTimeout,
		Promise,
		Math,
		Date,
		JSON,
		require,
		db,
	};
}

/* ---------------- ATTACHMENT HANDLER ---------------- */
async function getAttachmentContent(message) {
	const attachment = message.attachments.first();
	if (!attachment) return null;

	try {
		const res = await fetch(attachment.url);
		return await res.text();
	} catch {
		return null;
	}
}

/* ---------------- COMMAND ---------------- */
module.exports = {
	commandId: "5d9cda2c-31e5-4af5-9e93-7dc817af7582",
	name: "eval",
	aliases: ["ev"],
	description: "Owner-only eval (safe VM REPL + file support)",
	permissions: ["botOwner"],

	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.AttachFiles,
	],

	/** @param {Message} message */
	async execute(message, args) {
		let code = args.join(" ");

		// strip codeblocks
		code = code.replace(/^```(?:\w+)?\n?([\s\S]*?)```$/g, "$1");
		code = code.replace(/^`([^`]+)`$/, "$1");

		// ---------------- FILE SUPPORT ----------------
		const fileContent = await getAttachmentContent(message);
		if (fileContent) {
			code = code ? `${fileContent}\n${code}` : fileContent;
		}

		try {
			const vm = new VM({
				timeout: 5000,
				sandbox: createSandbox(message),
			});

			const timeout = (ms) =>
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("Eval timeout")), ms),
				);

			const result = await Promise.race([
				vm.run(`(async () => { ${code} })()`),
				timeout(5000),
			]);

			if (result instanceof Error) {
				const output = censor(result.stack || String(result));
				return message.channel.send(
					`Error:\n\`\`\`js\n${output}\`\`\``,
				);
			}

			let inspected = util.inspect(result, {
				depth: 4,
				maxArrayLength: Infinity,
				maxStringLength: Infinity,
			});

			inspected = censor(inspected);

			const lang = isCodeBlock(inspected) ? "javascript" : "";

			if (inspected.length > 1980) {
				return message.channel.send({
					content: "Output too large 📄",
					files: [
						{
							attachment: Buffer.from(inspected),
							name: "result.txt",
						},
					],
				});
			}
			return message.channel.send(`\`\`\`${lang}\n${inspected}\`\`\``);
		} catch (err) {
			const output = censor(err?.stack || String(err));
			return message.channel.send(`Error:\n\`\`\`js\n${output}\`\`\``);
		}
	},
};
