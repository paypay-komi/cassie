const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	AttachmentBuilder,
	MessageFlags,
} = require("discord.js");
const CELLS = 30000;
const MAX_STEPS = 100000;
const MAX_OUTPUT = 2000;
function v2(text) {
	return {
		components: [
			new ContainerBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(text),
			),
		],
		flags: MessageFlags.IsComponentsV2,
	};
}
module.exports = {
	commandId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
	name: "bf",
	description: "Run a Brainfuck program.",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages],
	aliases: ["brainfuck"],

	async execute(message, args) {
		let code = args.join(" ").trim();

		// -----------------------------
		// File upload support (text-based)
		// -----------------------------
		if (message.attachments.size > 0) {
			const attachment = message.attachments.first();

			try {
				const response = await fetch(attachment.url);
				code = await response.text();

				// Basic validation: must contain at least some BF chars
				const bfChars = /[<>+\-.,\[\]]/;
				if (!bfChars.test(code)) {
					return message.reply(
						v2(
							"❌ The uploaded file does not appear to contain Brainfuck code.",
						),
					);
				}
			} catch (err) {
				console.error(err);
				return message.reply(
					v2("❌ Failed to read the uploaded file as text."),
				);
			}
		}

		if (!code) {
			return message.reply(
				v2("Provide Brainfuck code or upload a text file."),
			);
		}

		// -----------------------------
		// Reject input instruction
		// -----------------------------
		if (code.includes(",")) {
			return message.reply(
				v2(
					"❌ This Brainfuck interpreter does not support input (` , `) instructions.",
				),
			);
		}
		code = code.replace(/[^\[\]<>+\-.,]/g, "");
		// -----------------------------
		// Setup interpreter
		// -----------------------------
		const cells = new Uint8Array(CELLS);
		let ptr = 0;
		let ip = 0;
		let steps = 0;
		const output = [];

		// -----------------------------
		// Build jump table
		// -----------------------------
		const jumps = {};
		const stack = [];

		for (let i = 0; i < code.length; i++) {
			if (code[i] === "[") {
				stack.push(i);
			} else if (code[i] === "]") {
				if (!stack.length) {
					return message.reply(v2("❌ Unmatched `]` in code."));
				}

				const open = stack.pop();
				jumps[open] = i;
				jumps[i] = open;
			}
		}

		if (stack.length) {
			return message.reply(v2("❌ Unmatched `[` in code."));
		}

		// -----------------------------
		// Execute
		// -----------------------------
		while (ip < code.length && steps < MAX_STEPS) {
			const c = code[ip];

			switch (c) {
				case ">":
					if (ptr < CELLS - 1) ptr++;
					break;

				case "<":
					if (ptr > 0) ptr--;
					break;

				case "+":
					cells[ptr]++;
					break;

				case "-":
					cells[ptr]--;
					break;

				case ".":
					output.push(String.fromCharCode(cells[ptr]));
					break;

				case "[":
					if (cells[ptr] === 0) {
						ip = jumps[ip];
					}
					break;

				case "]":
					if (cells[ptr] !== 0) {
						ip = jumps[ip];
					}
					break;
			}

			ip++;
			steps++;
		}

		// -----------------------------
		// Output formatting
		// -----------------------------
		let result = output.join("");

		if (!result) result = "(no output)";

		if (steps >= MAX_STEPS) {
			result += "\n⚠️ Hit instruction limit";
		}

		if (result.length > MAX_OUTPUT) {
			const attachment = new AttachmentBuilder(
				Buffer.from(result, "utf-8"),
				{ name: "bf-output.txt" },
			);
			await message.reply(
				v2(
					"**Brainfuck Output**\n⚠️ Output exceeded 2000 chars — attached as `bf-output.txt`",
				),
			);
			return message.channel.send({ files: [attachment] });
		}

		return message.reply(
			v2("**Brainfuck Output**\n" + "```text\n" + result + "\n```"),
		);
	},
};
