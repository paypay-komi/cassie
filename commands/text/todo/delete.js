const { PermissionsBitField } = require("discord.js");
const { getLogger } = require("../../../lib/logger");
const { fetchUserTodoList } = require("./utils/fetchuserTodoList.js");
const { ArgsBuilder } = require("../../../lib/argsBuilder");
module.exports = {
	commandId: "a2dd3826-9a5b-41b0-bedd-ef4dbce1afd0",
	name: "delete",
	description: "Delete a todo item by its ID",
	args: ArgsBuilder.create()
		.integer("id", { required: true, description: "Item number to delete" }),
	requiredBotPermissions: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
	aliases: ["d", "del", "remove", "r"],
	parent: "todo",
	async execute(message, args) {
		const log = getLogger("TodoDelete");
		const itemIndex = parseInt(args[0], 10) - 1;
		if (isNaN(itemIndex)) {
			return message.reply(
				"Please provide a valid item number to delete.",
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
		message.client.db.prisma.todolist
			.delete({
				where: { id: todo.id },
			})
			.then(() => {
				message.reply(`Deleted item ${itemIndex + 1}: ${todo.content}`);
			})
			.catch((error) => {
				log.error("Error deleting todo item:", error);
				message.reply(
					"Failed to delete the item. Please try again later.",
				);
			});
	},
};
