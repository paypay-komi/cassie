const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const { fetchUserTodoList } = require("./utils/fetchuserTodoList");
const { ArgsBuilder } = require("../../../lib/argsBuilder");

module.exports = {

commandId: "e542ce2e-4f18-4185-9d4b-7cb167b7d447",
	name: "complete",
	description: "Mark a todo item as done",
	args: ArgsBuilder.create()
		.integer("id", { required: true, description: "Item number to mark done" }),
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	parent: "todo",
	aliases: ["done", "markdone", "finish"],
	async execute(message, args) {
		const log = getLogger("TodoDone");
		const itemIndex = parseInt(args[0], 10) - 1;
		if (isNaN(itemIndex)) {
			return message.reply(
				"Please provide a valid item number to mark as done.",
			);
		}
		const userId = message.author.id;
		const todos = await fetchUserTodoList(message.client, userId);

		if (itemIndex < 0 || itemIndex >= todos.length) {
			return message.reply(
				"Item number out of range. Please check your todo list and try again.",
			);
		}
		const todo = todos[itemIndex];
		if (!todo) {
			return message.reply(
				"Todo item not found. Please check your todo list and try again.",
			);
		}
		if (todo.completed) {
			return message.reply("This item is already marked as done.");
		}
		message.client.db.prisma.todolist
			.update({
				where: { id: todo.id },
				data: { completed: true },
			})
			.then(() => {
				message.reply(
					`Marked item ${itemIndex + 1} as done: ${todo.content}`,
				);
			})
			.catch((error) => {
				log.error("Error marking todo item as done:", error);
				message.reply(
					"Failed to mark the item as done. Please try again later.",
				);
			});
	},
};
