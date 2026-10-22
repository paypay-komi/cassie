const { Counting } = require("../lib/counting");
const { buildMessage } = require("../lib/v2Reply");

module.exports = {
    name: "messageCreate",
    async execute(client, message) {
        if (message.author.bot || !message.guild) return;
        if (!message.content.trim()) return;

        const counting = await Counting.getConfig(message.guild.id);
        if (!counting || !counting.enabled || !counting.channelId) return;
        if (message.channel.id !== counting.channelId) return;

        // Allow normal text if setting is enabled
        if (counting.allowText) {
            const num = Counting.parseNumber(message.content, counting.allowDecimals, counting.allowMath);
            if (num === null) return; // Not a number, let it through
        }

        const result = await Counting.processMessage(message, counting);

        if (!result.ok) {
            if (counting.showOnFail && result.message) {
                const reply = await message.reply(buildMessage(result.message, 0xED4245));
                if (counting.failMsgDeleteSeconds && counting.failMsgDeleteSeconds > 0) {
                    setTimeout(() => reply.delete().catch(() => {}), counting.failMsgDeleteSeconds * 1000);
                }
            }
            if (counting.reactOnWrong) {
                await message.react("❌").catch(() => {});
            }
            if (counting.deleteWrong) {
                await message.delete().catch(() => {});
            }
            if (result.reset && counting.resetOnFail) {
                await Counting.resetCount(message.guild.id);
            }
        } else if (result.milestone) {
            await message.reply(buildMessage(result.milestone, 0xFAA61A));
        } else if (result.ok) {
            if (counting.reactOnCorrect) {
                await message.react("✅").catch(() => {});
            }
        }
    },
};
