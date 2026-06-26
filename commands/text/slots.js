const {
	PermissionsBitField,
	ContainerBuilder,
	TextDisplayBuilder,
	MediaGalleryBuilder,
	AttachmentBuilder,
	MessageFlags,
} = require("discord.js");
const { renderSlotGif } = require("../../utils/slotRenderer");

const NUKE = "💀";
const REELS = [
	{ sym: "🍒", weight: 30 },
	{ sym: "🍋", weight: 25 },
	{ sym: "🍊", weight: 18 },
	{ sym: "🍇", weight: 12 },
	{ sym: "🔔", weight: 8 },
	{ sym: "💎", weight: 4 },
	{ sym: "7️⃣", weight: 3 },
	{ sym: NUKE, weight: 20 },
];

const PAYOUTS = {
	"🍒": { multi: 2, half: 4 },
	"🍋": { multi: 4, half: false },
	"🍊": { multi: 6, half: false },
	"🍇": { multi: 12, half: false },
	"🔔": { multi: 24, half: false },
	"💎": { multi: 30, half: false },
	"7️⃣": { multi: 80, half: false },
};

const PAYLINES = [
	{
		name: "top row",
		cells: [
			[0, 0],
			[0, 1],
			[0, 2],
		],
	},
	{
		name: "middle row",
		cells: [
			[1, 0],
			[1, 1],
			[1, 2],
		],
	},
	{
		name: "bottom row",
		cells: [
			[2, 0],
			[2, 1],
			[2, 2],
		],
	},
	{
		name: "diagonal ↘",
		cells: [
			[0, 0],
			[1, 1],
			[2, 2],
		],
	},
	{
		name: "diagonal ↗",
		cells: [
			[2, 0],
			[1, 1],
			[0, 2],
		],
	},
	{
		name: "left column",
		cells: [
			[0, 0],
			[1, 0],
			[2, 0],
		],
	},
	{
		name: "middle column",
		cells: [
			[0, 1],
			[1, 1],
			[2, 1],
		],
	},
	{
		name: "right column",
		cells: [
			[0, 2],
			[1, 2],
			[2, 2],
		],
	},
];

function pick() {
	const total = REELS.reduce((s, r) => s + r.weight, 0);
	let r = Math.random() * total;
	for (const entry of REELS) {
		r -= entry.weight;
		if (r <= 0) return entry.sym;
	}
	return REELS[REELS.length - 1].sym;
}



module.exports = {
	commandId: "abea06f4-75ce-41b3-bcbd-2a7a31e2ce45",
	name: "slots",
	description: "gambling with slots",
	requiredBotPermissions: [
		PermissionsBitField.Flags.SendMessages,
		PermissionsBitField.Flags.ReadMessageHistory,
		PermissionsBitField.Flags.AttachFiles,
	],
	aliases: ["spin"],

	async execute(message, args) {
		const econ = message.client.db.economy;
		const config = await econ.getConfig(message.guildId);
		if (!config.enabled)
			return message.reply(v2("Economy is disabled in this server."));

		const bet = parseInt(args[0], 10);
		if (isNaN(bet) || bet <= 0)
			return message.reply(
				v2("Provide a valid bet amount.\nUsage: `c.slots <amount>`"),
			);

		const balance = await econ.getBalance(
			message.guildId,
			message.author.id,
		);
		if (balance < bet)
			return message.reply(v2("You don't have enough to bet that much."));

		const numOfReels = 3;
		const sizeOfReel = 3;
		const spinPerReel = 30;
		const frameDelay = 80;

		const finalGrid = [];
		for (let r = 0; r < sizeOfReel; r++) {
			finalGrid[r] = [];
			for (let c = 0; c < numOfReels; c++) {
				finalGrid[r][c] = pick();
			}
		}

		const hits = [];
		const nuked = [];
		for (const line of PAYLINES) {
			const syms = line.cells.map(([r, c]) => finalGrid[r][c]);
			if (syms.includes(NUKE)) {
				const filtered = syms.filter((s) => s !== NUKE);
				if (filtered.length === 2 && filtered[0] === filtered[1] && PAYOUTS[filtered[0]]?.half) {
					nuked.push({ name: line.name, sym: filtered[0] });
				}
				continue;
			}
			if (syms.every((s) => s === syms[0])) {
				hits.push({ name: line.name, sym: syms[0], multi: PAYOUTS[syms[0]]?.multi ?? 1 });
				continue;
			}
			const counts = {};
			for (const s of syms) counts[s] = (counts[s] || 0) + 1;
			const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
			if (best[1] === 2 && PAYOUTS[best[0]]?.half) {
				hits.push({ name: line.name, sym: best[0], multi: PAYOUTS[best[0]].multi / PAYOUTS[best[0]].half });
			}
		}

		const totalMulti = hits.reduce((s, h) => s + h.multi, 0);
		const profit = totalMulti * bet;

		if (profit > 0) {
			await econ.addBalance(
				message.guildId,
				message.author.id,
				profit,
				"slots",
				`Won slots (${hits.map((h) => `${h.sym}x${h.multi}`).join(", ")})`,
			);
		} else {
			await econ.removeBalance(
				message.guildId,
				message.author.id,
				bet,
				"slots",
				"Lost slots",
			);
		}

		const newBal = await econ.getBalance(
			message.guildId,
			message.author.id,
		);
		const sym = config.currencySymbol;
		const plural =
			newBal === 1 ? config.currencyName : config.currencyNamePlural;

		let resultText =
			profit > 0
				? `**You won ${sym}${profit.toLocaleString()} ${profit === 1 ? config.currencyName : config.currencyNamePlural}!**`
				: `**No win — lost ${sym}${bet.toLocaleString()} ${bet === 1 ? config.currencyName : config.currencyNamePlural}.**`;
		if (profit > 0) {
			resultText += `\n${hits.map((h) => `${h.sym} ${h.name} (x${h.multi})`).join(" | ")}`;
		}
		if (nuked.length) {
			resultText += `\n💀 Nuked: ${nuked.map((n) => `${n.sym} ${n.name}`).join(" | ")}`;
		}
		resultText += `\nBalance: ${sym}${newBal.toLocaleString()} ${plural}`;

		try {
			const gifBuffer = await renderSlotGif(REELS, finalGrid, {
				numReels: numOfReels,
				reelHeight: sizeOfReel,
				spinPerReel,
				frameDelay,
			});

			const mediaGallery = new MediaGalleryBuilder({
				items: [
					{
						media: { url: "attachment://slots.gif" },
					},
				],
			});

			const spinContainer = new ContainerBuilder()
				.addMediaGalleryComponents(mediaGallery)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent("🎰 Spinning..."),
				);

			const sent = await message.reply({
				components: [spinContainer],
				flags: MessageFlags.IsComponentsV2,
				files: [
					new AttachmentBuilder(gifBuffer, { name: "slots.gif" }),
				],
			});

			const animMs = (numOfReels * spinPerReel + 3) * frameDelay + 2000;
			await new Promise((r) => setTimeout(r, animMs));

			const resultContainer = new ContainerBuilder()
				.addMediaGalleryComponents(mediaGallery)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(resultText),
				);

			await sent.edit({
				components: [resultContainer],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (err) {
			console.error("slot gif render error:", err);
			await message.reply({
				components: [
					new ContainerBuilder().addTextDisplayComponents(
						new TextDisplayBuilder().setContent(resultText),
					),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	},
};
