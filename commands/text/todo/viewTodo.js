const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    InteractionType,
} = require('discord.js');
const { fetchUserTodoList } = require('./utils/fetchuserTodoList');
function paginate(text, itemsPerPage = 10) {
    const pages = [];
    for (let i = 0; i < text.length; i += itemsPerPage) {
        pages.push(text.slice(i, i + itemsPerPage));
    }
    return pages;
}
function createEmbed(currentPage, items) {
    const embed = new EmbedBuilder()
        .setTitle('Your Todo List')
        .setDescription(
            items[currentPage]
                .map(
                    (item, index) =>
                        `${currentPage * 10 + index + 1}. (${item.completed ? '✓' : '✗'}) ${item.content}`,
                )
                .join('\n'),
        )

        .setFooter({ text: `Page ${currentPage + 1}/${items.length}` });
    return embed;
}
module.exports = {
    name: 'view',
    description: 'View your todo list',
    aliases: ['vt', 'list'],
    parent: 'todo',
    async execute(message, args) {
        const userId = message.author.id;
        const todos = await fetchUserTodoList(message.client, userId);

        if (todos.length === 0) {
            return message.reply('Your todo list is empty!');
        }

        const pages = paginate(todos, 10);
        let currentPage = 0;
        const embedMessage = await message.reply({
            embeds: [createEmbed(currentPage, pages)],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === pages.length - 1),
                ),
            ],
        });
        const filter = (i) => i.user.id === message.author.id;
        const collector = embedMessage.createMessageComponentCollector({
            filter,
            idle: 60000,
        });
        collector.on('collect', async (interaction) => {
            if (interaction.type !== InteractionType.MessageComponent) return;
            if (
                interaction.customId === 'next' &&
                currentPage < pages.length - 1
            ) {
                currentPage++;
            } else if (interaction.customId === 'prev' && currentPage > 0) {
                currentPage--;
            }
            await interaction.update({
                embeds: [createEmbed(currentPage, pages)],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('prev')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 0),
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === pages.length - 1),
                    ),
                ],
            });
        });
        collector.on('end', async () => {
            await embedMessage.edit({ components: [] });
        });
    },
};
