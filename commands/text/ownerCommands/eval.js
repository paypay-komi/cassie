const { VM } = require("vm2");
const util = require("util");
const db = require("../../../db/boobs");
function createSandbox(message) {
	return {
		// Discord context
		client: message.client,
		message,
		channel: message.channel,
		guild: message.guild,
		user: message.author,

		// JS globals
		Buffer,
		console,
		setTimeout,
		clearTimeout,
		Promise,
		Math,
		Date,
		JSON,

		// Node access (be careful, but you asked for full context style)
		require,

		// your stuff (if exists)
		db: db,
	};
}
module.exports = {
	name: "eval",
	aliases: ["ev"],
	description: "Owner-only eval (safe VM REPL)",

	async execute(message, args) {
		const code = args.join(" ");
		const TIMEOUT_MS = 5000;

		try {
			const vm = new VM({
				timeout: TIMEOUT_MS,
				sandbox: createSandbox(message),
			});

			let result = vm.run(`
				(async () => {
					${code}
				})()
			`);

			// handle promises
			if (result instanceof Promise) {
				result = await result;
			}

			const output =
				typeof result === "object"
					? util.inspect(result, { depth: 3, colors: false })
					: String(result);

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

			return message.channel.send(`\`\`\`js\n${output}\`\`\``);
		} catch (err) {
			const msg = String(err?.stack || err);

			return message.channel.send(
				msg.length > 1980
					? {
							content: "Error too large 📄",
							files: [
								{
									attachment: Buffer.from(msg),
									name: "error.txt",
								},
							],
						}
					: `Error:\n\`\`\`js\n${msg}\`\`\``,
			);
		}
	},
};
