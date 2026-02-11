const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'gif',
    description: 'Sends a random bunny gif',
    parent: 'bunny',
    async execute(message, args) {
        const fetch = require('node-fetch');
        const response = await fetch('https://api.bunnies.io/v2/loop/random/?media=gif');
        const data = await response.json();
        if (!data || !data.media || !data.media.gif) {
            return message.reply('Sorry, I could not fetch a bunny gif at this time.');
        }
        const embed = new EmbedBuilder()
            .setTitle('🐰 Here is a random bunny gif for you!')
            .setImage(data.media.gif)
            .setFooter({ text: `this bunny source is ${data.source}` })
            .setColor(0xFFC0CB);
        return message.reply({ embeds: [embed] });
    }
};
