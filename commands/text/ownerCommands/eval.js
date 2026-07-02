const { PermissionsBitField, Message } = require("discord.js");
const { VM } = require("vm2");
const util = require("util");
const db = require("../../../db");

function censor(value) {
	if (typeof value !== "string") return value;

	// Match: keyword = "...", keyword: "...", keyword(...)
	// Where keyword is token, api_key, apikey, auth, password, secret, key, pass
	const tokenPattern =
		/\b(token|api_key|apikey|auth|password|secret|key|pass)\s*[=\(\s]\s*(['"`])([a-zA-Z0-9_\-\.]{16,64})\s*\2/g;
	return value.replace(tokenPattern, (match, key, quote, token) => {
		const masked =
			token.substring(0, 8) +
			(token.length > 8 ? ".." + token.length : "");
		return `**${key}***TOKEN***:${masked}${quote}`;
	});
}

function isCodeBlock(input) {
	if (typeof input !== "string") return false;
	const lines = input.split("\n");
	return lines.some((line) => {
		// Multiline strings returned from eval that look like code (common patterns)
		return (
			line.includes("console.") ||
			line.includes("process.") ||
			line.includes(" = ") ||
			line.match(
				/^\s*(const|let|var|function|class|if|for|while|switch|try|import|export)\b/,
			) !== null ||
			line.includes("=>") ||
			line.includes("}") ||
			line.includes("{")
		);
	});
}
/**@param {Message} message  */
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
		db: db,
	};
}

module.exports = {
	commandId: "5d9cda2c-31e5-4af5-9e93-7dc817af7582",
	name: "eval",
	aliases: ["ev"],
	description: "Owner-only eval (safe VM REPL)",
	permissions: ["botOwner"],
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.AttachFiles,
	],
	/**@param {Message} message  */
	async execute(message, args) {
		let code = args.join(" ");

		// Strip code blocks from input: ```js, ```javascript, ```json, or just ```
		code = code.replace(/^```(?:\w+)?\n?([\s\S]*?)```$/g, "$1");
		// Also strip inline `code` if the whole thing is wrapped
		code = code.replace(/^`([^`]+)`$/, "$1");

		try {
			const vm = new VM({
				timeout: 5000,
				sandbox: createSandbox(message),
			});

			const result = await vm.runAsync(`
				(async () => {
					${code}
				})()
			`);

			let output;
			const isError = result instanceof Error;

			if (isError) {
				output = censor(result.stack || String(result));
				return message.channel.send(
					`Error:\n\`\`\`javascript\n${output}\`\`\``,
				);
			}

			const inspected = util.inspect(result, {
				maxArrayLength: Infinity,
				maxStringLength: Infinity,
				depth: Infinity,
			});
			output = censor(inspected);

			// Decide code block language based on result
			const lang =
				isCodeBlock(String(result)) || isCodeBlock(inspected)
					? "javascript"
					: "";

			if (output.length > 1980) {
				return message.channel.send({
					content: "Output too large 📄",
					files: [
						{
							attachment: Buffer.from(output),
							name: "result.txt",
						},
					],
				});
			}

			return message.channel.send(`\`\`\`${lang}\n${output}\`\`\``);
		} catch (err) {
			const errorMsg = censor(err?.stack || String(err));
			return message.channel.send(`Error:\n\`\`\`js\n${errorMsg}\`\`\``);
		}
	},
};
