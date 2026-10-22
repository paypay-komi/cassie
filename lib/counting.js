const db = require("../db");
const { evaluateMath } = require("./mathSafe");

class Counting {
    static async getConfig(guildId) {
        return db.prisma.countingConfig.findUnique({ where: { guildId } });
    }

    static async getScore(guildId, userId) {
        return db.prisma.countingScore.findUnique({ where: { guildId_userId: { guildId, userId } } });
    }

    static async incrementScore(guildId, userId, correct = true) {
        return db.prisma.countingScore.upsert({
            where: { guildId_userId: { guildId, userId } },
            create: { guildId, userId, score: 1n, correct: correct ? 1 : 0, wrong: correct ? 0 : 1, lastCountAt: new Date() },
            update: {
                score: { increment: 1n },
                correct: { increment: correct ? 1 : 0 },
                wrong: { increment: correct ? 0 : 1 },
                lastCountAt: new Date(),
            },
        });
    }

    static parseNumber(str, allowDecimals, allowMath) {
        const clean = str.trim();
        if (!clean) return null;

        if (allowMath) {
            try {
                const result = evaluateMath(clean);
                if (typeof result === "number" && isFinite(result)) return result;
            } catch { }
        }

        if (allowDecimals) {
            const num = parseFloat(clean);
            if (!isNaN(num) && isFinite(num)) return num;
        } else {
            const num = parseInt(clean, 10);
            if (!isNaN(num)) return num;
        }
        return null;
    }

    static async processMessage(message, config) {
        const expected = Number(config.currentCount) + 1;
        const userNumber = this.parseNumber(message.content, config.allowDecimals, config.allowMath);

        if (userNumber === null) {
            return { ok: false, action: "delete", message: "❌ That's not a valid number, dummy!", reset: false };
        }

        if (userNumber !== expected) {
            return { ok: false, action: "delete", message: `❌ WRONG! Expected **${expected}**, got **${userNumber}**. Count reset to 0, you ruined it!`, reset: true };
        }

        if (config.lastCounterId === message.author.id && config.cooldownMs > 0) {
            const lastCount = config.lastCountAt ? new Date(config.lastCountAt).getTime() : 0;
            if (Date.now() - lastCount < config.cooldownMs) {
                return { ok: false, action: "delete", message: `❌ ${message.author}, you can't count twice in a row! Count reset to 0.`, reset: true };
            }
        }

        const newCount = BigInt(expected);
        const newHighScore = newCount > config.highScore ? newCount : config.highScore;

        await db.prisma.countingConfig.update({
            where: { guildId: config.guildId },
            data: {
                currentCount: newCount,
                highScore: newHighScore,
                lastCounterId: message.author.id,
                lastCountAt: new Date(),
            },
        });

        await this.incrementScore(config.guildId, message.author.id, true);

        let milestone = null;
        if (newCount === 100n || newCount === 1000n || newCount === 10000n) {
            milestone = `🎉 **${expected}**! Milestone reached!`;
        }

        return { ok: true, milestone };
    }

    static async resetCount(guildId) {
        await db.prisma.countingConfig.update({
            where: { guildId },
            data: { currentCount: 0n, lastCounterId: null, lastCountAt: null },
        });
    }

    static async setConfig(guildId, data) {
        const updateData = {};
        const allowed = ["enabled", "channelId", "resetOnFail", "deleteWrong", "allowDecimals", "allowMath", "allowText", "cooldownMs", "ephemeralFail", "deleteOnFail", "showOnFail", "reactOnWrong", "reactOnCorrect", "failMsgDeleteSeconds"];
        for (const key of allowed) {
            if (data[key] !== undefined) updateData[key] = data[key];
        }
        if (data.currentCount !== undefined) updateData.currentCount = BigInt(data.currentCount);
        if (data.highScore !== undefined) updateData.highScore = BigInt(data.highScore);

        return db.prisma.countingConfig.upsert({
            where: { guildId },
            create: { guildId, ...updateData, currentCount: updateData.currentCount ?? 0n, highScore: updateData.highScore ?? 0n },
            update: updateData,
        });
    }

    static async getLeaderboard(guildId, limit = 10) {
        return db.prisma.countingScore.findMany({
            where: { guildId },
            orderBy: { score: "desc" },
            take: limit,
        });
    }
}

module.exports = { Counting };
