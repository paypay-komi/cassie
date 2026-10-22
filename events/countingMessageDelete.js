const { Counting } = require("../lib/counting");
const { buildMessage } = require("../lib/v2Reply");

module.exports = {
    name: "messageDelete",
    async execute(client, message) {
        if (message.partial) {
            try {
                await message.fetch();
            } catch {
                return;
            }
        }
        if (message.author.bot || !message.guild) return;
        if (!message.content.trim()) return;

        const counting = await Counting.getConfig(message.guild.id);
        if (!counting || !counting.enabled || !counting.channelId) return;
        if (message.channel.id !== counting.channelId) return;

        const num = Counting.parseNumber(message.content, counting.allowDecimals, counting.allowMath);
        if (num === null) return;

        const current = Number(counting.currentCount);
        // Only bully if the deleted message was the current count (already processed)
        // or the next expected number - but NOT if it was the correct next number
        // that the bot itself deleted (which shouldn't happen, but safety check)
        if (num === current || num === current + 1) {
            // If the deleted message was the CORRECT next number, don't bully -
            // the bot probably deleted it by mistake or it was already counted
            if (num === current + 1) {
                console.log('[COUNTING DELETE] Skipping bully - deleted message was the next expected number');
                return;
            }
            const bully = [
                `🗑️ HEY <@${message.author.id}> **deleted their message**! The count was **${num}**. You should bully them, they're a meanie!`,
                `🚨 <@${message.author.id}> tried to hide their count (**${num}**) by deleting it. What a coward! Bully them!`,
                `😤 <@${message.author.id}> deleted the number **${num}**. The count is now **${current}**. Bully this meanie!`,
                `⚠️ DELETED MESSAGE ALERT: <@${message.author.id}> removed **${num}**. The count is **${current}**. Go bully them!`,
            ];
            const msg = bully[Math.floor(Math.random() * bully.length)];
            await message.channel.send(buildMessage(msg, 0xED4245));
        }
    },
};