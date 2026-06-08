const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
module.exports = {
	commandId: "4e443a56-fac3-436a-a9b0-d6806ac2bdea",
	name: "create",
	description: "Create a new todo item",
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	aliases: ["c", "add", "a"],
	parent: "todo",
	async execute(message, args) {
		const log = getLogger("TodoCreate");
		message.client.db.prisma.todolist
			.create({
				data: {
					userId: message.author.id,
					content: args.join(" "),
					completed: false,
					createdAt: new Date(),
				},
			})
			.then((todo) => {
				message.reply(`Created todo item: ${todo.content}`);
			})
			.catch((error) => {
				log.error("Error creating todo item:", error);
				message.reply("Failed to create todo item.");
			});
	},
};
