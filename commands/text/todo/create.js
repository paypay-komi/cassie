module.exports = {
	name: "create",
	description: "Create a new todo item",
	aliases: ["c", "add", "a"],
	parent: "todo",
	async execute(message, args) {
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
				console.error("Error creating todo item:", error);
				message.reply("Failed to create todo item.");
			});
	},
};
