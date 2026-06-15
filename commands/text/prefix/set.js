const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {
	commandId: "55d4379a-e6af-4c69-bf9f-15d2a91056f8",
	name: "set",
	parent: "prefix",
	description: "Set your own custom command prefix.",
	args: ArgsBuilder.create()
		.string("prefix", { required: true, description: "Your custom prefix" }),

	async execute(message, args) {
		if (!args.length) {
			return message.reply(
				"Usage: `c.prefix set <prefix>` — e.g. `c.prefix set !`",
			);
		}

		const newPrefix = args.join(" ").trim();
		if (newPrefix === "c.") {
			return message.reply("`c.` is already the universal prefix.");
		}

		await message.client.db.userPrefix.set(message.author.id, newPrefix);

		message.reply(
			`Your prefix has been set to \`${newPrefix}\`. Remember \`c.\` also works!`,
		);
	},
};
