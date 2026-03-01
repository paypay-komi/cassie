async function fetchUserTodoList(client, userId) {
	return client.db.prisma.todolist
		.findMany({
			where: { userId },
		})
		.then((todoList) => {
			if (!todoList || todoList.length === 0) {
				console.log(`No todo list found for user ${userId}`);
				return [];
			}
			return todoList.sort((a, b) => {
				if (a.completed !== b.completed)
					return a.completed - b.completed;
				return b.createdAt - a.createdAt;
			});
		})
		.catch((error) => {
			console.error(
				`Error fetching todo list for user ${userId}:`,
				error,
			);
			return [];
		});
}
module.exports = { fetchUserTodoList };
