const { fetchUserTodoList } = require('./utils/fetchuserTodoList.js');
module.exports = {
    name: 'delete',
    description: 'Delete a todo item by its ID',
    aliases: ['d', 'del', 'remove', 'r'],
    parent: 'todo',
    async execute(message, args) {
        const itemIndex = parseInt(args[0], 10) - 1;
        if (isNaN(itemIndex)) {
            return message.reply('Please provide a valid item number to delete.');
        }
        const userId = message.author.id;
        const todos = await fetchUserTodoList(message.client, userId);
        if (itemIndex < 0 || itemIndex >= todos.length) {
            return message.reply('Item number out of range. Please check your todo list and try again.');
        }
        const todo = todos[itemIndex];
        if (!todo) {
            return message.reply('Todo item not found. Please check your todo list and try again.');
        }
        message.client.db.prisma.todolist.delete({
            where: { id: todo.id }
        })
            .then(() => {
                message.reply(`Deleted item ${itemIndex + 1}: ${todo.content}`);
            })
            .catch(error => {
                console.error('Error deleting todo item:', error);
                message.reply('Failed to delete the item. Please try again later.');
            }
            );
    }
}
