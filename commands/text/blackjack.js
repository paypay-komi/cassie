const {
	ContainerBuilder,
	TextDisplayBuilder,
	SeparatorBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	MessageFlags,
} = require("discord.js");

// ── Card constants ──────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_VALUES = Object.fromEntries(
	RANKS.map((r) => [r, /^\d+$/.test(r) ? parseInt(r, 10) : r === 'A' ? 11 : 10]),
);

const NUM_DECKS = 6;
const SHUFFLE_AT = 78; // reshuffle when 25% of shoe remains

function v2(text) {
	return {
		components: [
			new ContainerBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(text),
			),
		],
		flags: MessageFlags.IsComponentsV2,
	};
}

// ── Deck helpers ────────────────────────────────────────
function createDeck(num = NUM_DECKS) {
	const deck = [];
	for (let n = 0; n < num; n++)
		for (const s of SUITS)
			for (const r of RANKS) deck.push(`${r}${s}`);
	return deck;
}

function shuffle(deck) {
	for (let i = deck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}
}

function freshDeck() {
	const d = createDeck(NUM_DECKS);
	shuffle(d);
	return d;
}

function draw(deck) {
	if (deck.length <= SHUFFLE_AT) shuffle(deck);
	return deck.pop();
}

// ── Hand evaluation ────────────────────────────────────
function cardRank(card) {
	return card.slice(0, -1);
}

function calcValue(hand) {
	let total = 0, aces = 0;
	for (const c of hand) {
		const r = cardRank(c);
		if (r === 'A') { aces++; total += 11; }
		else total += RANK_VALUES[r];
	}
	while (total > 21 && aces > 0) { total -= 10; aces--; }
	return total;
}

function isSoft(hand) {
	const aces = hand.filter((c) => cardRank(c) === 'A').length;
	return aces > 0 && calcValue(hand) <= 21;
}

function isBJ(hand) {
	return hand.length === 2 && calcValue(hand) === 21;
}

function isBust(hand) {
	return calcValue(hand) > 21;
}

function formatHand(hand, hideFirst = false, gameOver = false) {
	if (!hand || hand.length === 0) return '*empty*';
	if (hideFirst && !gameOver) {
		return '🂠 ' + hand.slice(1).join(' ');
	}
	return hand.join(' ');
}

// ── Button builder ─────────────────────────────────────
function btn(id, label, style = ButtonStyle.Secondary, disabled = false) {
	return new ButtonBuilder()
		.setCustomId(id)
		.setLabel(label)
		.setStyle(style)
		.setDisabled(disabled);
}

// ── Game state ──────────────────────────────────────────
const activeGames = new Map();

class BlackjackGame {
	constructor(guildId, userId, bet, deck) {
		this.guildId = guildId;
		this.userId = userId;
		this.bet = bet;
		this.totalCost = bet;
		this.deck = deck;
		this.playerHands = [[]]; // one per split
		this.dealerHand = [];
		this.currentHand = 0; // index into playerHands
		this.insuranceBet = 0;
		this.insuranceResolved = false;
		this.surrendered = false;
		this.doubledHands = new Set();
		this.splitAces = false;
		this.phase = 'dealing'; // dealing → insurance → playing → dealer → done
	}

	deal() {
		this.dealerHand.push(draw(this.deck));
		this.playerHands[0].push(draw(this.deck));
		this.dealerHand.push(draw(this.deck));
		this.playerHands[0].push(draw(this.deck));
	}

	canSplit(handIdx) {
		const h = this.playerHands[handIdx];
		if (!h || h.length !== 2) return false;
		if (this.playerHands.length >= 4) return false;
		return cardRank(h[0]) === cardRank(h[1]);
	}

	canDouble(handIdx) {
		const h = this.playerHands[handIdx];
		return h && h.length === 2 && !this.doubledHands.has(handIdx);
	}

	canSurrender() {
		// Only on the first hand, before any action
		return this.currentHand === 0 && this.playerHands[0].length === 2 &&
			!this.surrendered && !this.doubledHands.has(0);
	}

	split(handIdx) {
		const h = this.playerHands[handIdx];
		this.playerHands[handIdx] = [h[0], draw(this.deck)];
		this.playerHands.push([h[1], draw(this.deck)]);
		this.totalCost += this.bet;
		// If splitting Aces, deal only one card per hand and auto-stand
		if (cardRank(h[0]) === 'A') {
			this.splitAces = true;
			this.playerHands[handIdx].push(draw(this.deck));
			const newIdx = this.playerHands.length - 1;
			this.playerHands[newIdx].push(draw(this.deck));
		}
	}

	double(handIdx) {
		this.doubledHands.add(handIdx);
		this.totalCost += this.bet;
		this.playerHands[handIdx].push(draw(this.deck));
	}

	dealerPlay() {
		while (true) {
			const v = calcValue(this.dealerHand);
			if (v > 21) break;
			if (v >= 17) {
				if (v === 17 && isSoft(this.dealerHand)) {
					this.dealerHand.push(draw(this.deck));
				} else break;
			} else {
				this.dealerHand.push(draw(this.deck));
			}
		}
	}
}

// ── Settle game, return payout ─────────────────────────
function settleGame(game) {
	const dealerVal = calcValue(game.dealerHand);
	const dealerBJ = isBJ(game.dealerHand);
	const dealerBust = dealerVal > 21;
	let totalPayout = 0;
	const outcomes = [];

	// Insurance payout
	if (game.insuranceBet > 0) {
		if (dealerBJ) {
			totalPayout += game.insuranceBet * 3;
		}
	}

	for (let i = 0; i < game.playerHands.length; i++) {
		const h = game.playerHands[i];
		const playerVal = calcValue(h);
		const playerBJ = isBJ(h);
		const handBet = game.doubledHands.has(i) ? game.bet * 2 : game.bet;
		let outcome, payout;

		if (game.surrendered) {
			outcome = 'surrender';
			payout = Math.floor(game.bet / 2);
		} else if (isBust(h)) {
			outcome = 'bust';
			payout = 0;
		} else if (playerBJ && dealerBJ) {
			outcome = 'push (both BJ)';
			payout = handBet;
		} else if (playerBJ) {
			outcome = 'blackjack 3:2';
			payout = handBet + Math.floor(handBet * 3 / 2);
		} else if (dealerBJ) {
			outcome = 'lose (dealer BJ)';
			payout = 0;
		} else if (dealerBust) {
			outcome = 'win (dealer bust)';
			payout = handBet * 2;
		} else if (playerVal > dealerVal) {
			outcome = 'win';
			payout = handBet * 2;
		} else if (playerVal === dealerVal) {
			outcome = 'push';
			payout = handBet;
		} else {
			outcome = 'lose';
			payout = 0;
		}

		totalPayout += payout;
		outcomes.push({ hand: i, outcome, payout });
	}

	// Insurance
	if (game.insuranceBet > 0) {
		if (dealerBJ) {
			totalPayout += game.insuranceBet * 3;
			outcomes.push({ hand: 'insurance', outcome: 'insurance win 2:1', payout: game.insuranceBet * 3 });
		} else {
			outcomes.push({ hand: 'insurance', outcome: 'insurance lost', payout: 0 });
		}
	}

	return { totalPayout, outcomes };
}

// ── V2 Display helpers ─────────────────────────────────
function getGameColor(game, gameOver) {
	if (!gameOver) return 0x5865F2; // Blurple
	const { totalPayout } = settleGame(game);
	const net = totalPayout - game.totalCost;
	if (net > 0) return 0x57F287; // Green
	if (net < 0) return 0xED4245; // Red
	return 0xFEE75C; // Yellow
}

function buildGameView(game, config, opts = {}) {
	const { extra = '', gameOver = false, buttons = null, actionRows = null, newBalance } = opts;
	const color = getGameColor(game, gameOver);
	const container = new ContainerBuilder().setAccentColor(color);

	// Title with optional extra text
	let title = '🃏 **Blackjack**';
	if (extra) title += '\n' + extra;
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
	container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

	// Dealer hand
	const showAll = gameOver || game.phase === 'dealer' || game.phase === 'done';
	const dealerVal = showAll ? calcValue(game.dealerHand) : calcValue(game.dealerHand.slice(1));
	let dealerText = 'Dealer: ' + formatHand(game.dealerHand, !showAll, gameOver);
	if (showAll) dealerText += ' = ' + dealerVal;
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(dealerText));
	container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

	// Player hand(s)
	for (let i = 0; i < game.playerHands.length; i++) {
		const h = game.playerHands[i];
		const v = calcValue(h);
		const label = game.playerHands.length > 1 ? 'Hand #' + (i + 1) : 'Your hand';
		let line = label + ': ' + formatHand(h, false, gameOver) + ' = ' + v;
		if (isBust(h)) line += ' 💥 **Bust**';
		else if (isBJ(h) && h.length === 2) line += ' 🎉 **BJ**';
		if (game.doubledHands.has(i)) line += ' *(doubled)*';
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
	}

	// Insurance / surrender info
	if (game.surrendered) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent('🏳️ Surrendered'));
	}
	if (game.insuranceBet > 0) {
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent('🛡️ Insurance: ' + game.insuranceBet));
	}

	// Balance (game-over only)
	if (gameOver && newBalance !== undefined) {
		const sym = config.currencySymbol;
		const balName = newBalance === 1 ? config.currencyName : config.currencyNamePlural;
		container.addTextDisplayComponents(
			new TextDisplayBuilder().setContent('Balance: ' + sym + newBalance.toLocaleString() + ' ' + balName),
		);
	}

	// Action rows (buttons)
	if (buttons && buttons.length > 0) {
		for (const row of buttons) {
			container.addActionRowComponents(row);
		}
	} else if (actionRows) {
		for (const row of actionRows) {
			container.addActionRowComponents(row);
		}
	}

	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
	};
}

function buildResultView(game, config, settlement, newBalance) {
	const { totalPayout, outcomes } = settlement;
	const net = totalPayout - game.totalCost;
	const color = getGameColor(game, true);
	const sym = config.currencySymbol;
	const balName = newBalance === 1 ? config.currencyName : config.currencyNamePlural;

	const container = new ContainerBuilder().setAccentColor(color);

	// Title
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent('🃏 **Blackjack — Results**'));
	container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

	// Dealer full hand
	const dealerVal = calcValue(game.dealerHand);
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent('Dealer: ' + game.dealerHand.join(' ') + ' = ' + dealerVal),
	);
	container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

	// Player hand(s)
	for (let i = 0; i < game.playerHands.length; i++) {
		const h = game.playerHands[i];
		const v = calcValue(h);
		const label = game.playerHands.length > 1 ? 'Hand #' + (i + 1) : 'Your hand';
		let line = label + ': ' + h.join(' ') + ' = ' + v;
		if (isBust(h)) line += ' 💥 **Bust**';
		else if (isBJ(h) && h.length === 2) line += ' 🎉 **BJ**';
		if (game.doubledHands.has(i)) line += ' *(doubled)*';
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
	}

	container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

	// Settlement details
	for (const o of outcomes) {
		let outcomeLine;
		if (o.hand === 'insurance') {
			outcomeLine = '🛡️ Insurance: ' + o.outcome;
		} else {
			const label = game.playerHands.length > 1 ? ' Hand #' + (o.hand + 1) + ':' : '';
			outcomeLine = label + ' ' + o.outcome + (o.payout > 0 ? ' — ' + sym + o.payout.toLocaleString() : '');
		}
		container.addTextDisplayComponents(new TextDisplayBuilder().setContent(outcomeLine));
	}

	// Net result
	let netLine;
	if (net > 0) {
		netLine = '🎉 **Net win: ' + sym + net.toLocaleString() + '**';
	} else if (net < 0) {
		netLine = '😞 **Net loss: ' + sym + Math.abs(net).toLocaleString() + '**';
	} else {
		netLine = '🤝 **Push — nothing lost**';
	}
	container.addTextDisplayComponents(new TextDisplayBuilder().setContent(netLine));

	// Balance
	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent('Balance: ' + sym + newBalance.toLocaleString() + ' ' + balName),
	);

	return {
		components: [container],
		flags: MessageFlags.IsComponentsV2,
	};
}

// ── Main command ────────────────────────────────────────
module.exports = {
	commandId: 'e7b3a1c9-2d5f-4b8a-9c6e-1f0d3a7b2e8c',
	name: 'blackjack',
	aliases: ['bj', 'twentyone', '21'],
	description: 'Play blackjack against the dealer. Hit, stand, double, split, surrender, insurance.',
	guildUse: true,

	async execute(message, args) {
		const econ = message.client.db.economy;
		const config = await econ.getConfig(message.guildId);
		if (!config.enabled)
			return message.reply(v2('Economy is disabled in this server.'));

		const prefix = (await message.client.db.guild.getPrefix(message.guildId)) || 'c.';

		const amount = parseInt(args[0], 10);
		if (isNaN(amount) || amount <= 0)
			return message.reply(v2(`Provide a valid bet amount.\nUsage: \`${prefix}blackjack <amount>\``));

		if (activeGames.has(message.author.id))
			return message.reply(v2('You already have an active blackjack game! Finish it first.'));

		const balance = await econ.getBalance(message.guildId, message.author.id);
		if (balance < amount)
			return message.reply(v2("You don't have enough to bet that much."));

		// Deduct initial bet
		await econ.removeBalance(message.guildId, message.author.id, amount, 'blackjack', 'Blackjack bet');

		const game = new BlackjackGame(message.guildId, message.author.id, amount, freshDeck());
		game.deal();
		activeGames.set(message.author.id, game);

		const playerBJ = isBJ(game.playerHands[0]);
		const dealerUpRank = cardRank(game.dealerHand[1]); // dealerHand[0] is hidden, [1] is visible up-card
		const dealerShowsAce = dealerUpRank === 'A';
		const dealerShowsTen = RANK_VALUES[dealerUpRank] === 10;
		const dealerBJ = isBJ(game.dealerHand);

		// ── Helper: start normal play loop ──
		const startPlay = async (msg) => {
			game.phase = 'playing';

			if (playerBJ && !dealerBJ) {
				// Player has BJ, dealer doesn't — auto-win
				game.phase = 'done';
				const settlement = settleGame(game);
				if (settlement.totalPayout > 0) {
					await econ.addBalance(game.guildId, game.userId, settlement.totalPayout, 'blackjack', 'Blackjack win');
				}
				activeGames.delete(game.userId);
				const newBal = await econ.getBalance(game.guildId, game.userId);
				try {
					await msg.edit(buildResultView(game, config, settlement, newBal));
				} catch { /* ignore */ }
				return;
			}

			try {
				await msg.edit(buildGameView(game, config, { buttons: gameButtons(game) }));
				attachCollector(msg, game);
			} catch { /* ignore */ }
		};

		// ── Send initial message based on dealer up-card ──
		let msg;

		if (dealerShowsAce && !playerBJ) {
			// Offer insurance
			const insRow = new ActionRowBuilder().addComponents(
				btn('bj_insurance_yes', '✅ Yes (pay ' + Math.floor(amount / 2) + ')', ButtonStyle.Primary),
				btn('bj_insurance_no', '❌ No', ButtonStyle.Secondary),
			);
			msg = await message.reply(buildGameView(game, config, {
				extra: 'Dealer shows an Ace. Take insurance? (cost: half your bet)',
				actionRows: [insRow],
			}));

			const filter = (i) => i.user.id === message.author.id;
			let collected;
			try {
				collected = await msg.awaitMessageComponent({
					filter,
					componentType: ComponentType.Button,
					time: 15_000,
				});
			} catch {
				// Timeout — no insurance
			}

			if (collected) {
				if (collected.customId === 'bj_insurance_yes') {
					const insBet = Math.floor(amount / 2);
					const insBalance = await econ.getBalance(game.guildId, game.userId);
					if (insBalance >= insBet) {
						await econ.removeBalance(game.guildId, game.userId, insBet, 'blackjack', 'Insurance bet');
						game.insuranceBet = insBet;
						game.totalCost += insBet;
					}
					// If insufficient funds, just skip insurance
				}
				await collected.deferUpdate();
			}

			game.insuranceResolved = true;

			// Check if dealer has BJ after insurance resolved
			if (dealerBJ) {
				game.phase = 'done';
				const settlement = settleGame(game);
				if (settlement.totalPayout > 0) {
					await econ.addBalance(game.guildId, game.userId, settlement.totalPayout, 'blackjack', 'Blackjack result');
				}
				activeGames.delete(game.userId);
				const newBal = await econ.getBalance(game.guildId, game.userId);
				try {
					await msg.edit(buildResultView(game, config, settlement, newBal));
				} catch { /* ignore */ }
				return;
			}

			// No dealer BJ — continue playing (insurance is lost)
			return startPlay(msg);

		} else if (dealerShowsTen && dealerBJ) {
			// Dealer has BJ — auto-resolve
			game.phase = 'done';
			const settlement = settleGame(game);
			if (settlement.totalPayout > 0) {
				await econ.addBalance(game.guildId, game.userId, settlement.totalPayout, 'blackjack', 'Blackjack result');
			}
			activeGames.delete(game.userId);
			const newBal = await econ.getBalance(game.guildId, game.userId);
			msg = await message.reply(buildResultView(game, config, settlement, newBal));
			return;

		} else {
			// Normal play
			msg = await message.reply(buildGameView(game, config));

			// If player has BJ and dealer doesn't show ace/ten, auto-win
			if (playerBJ) {
				game.phase = 'done';
				const settlement = settleGame(game);
				if (settlement.totalPayout > 0) {
					await econ.addBalance(game.guildId, game.userId, settlement.totalPayout, 'blackjack', 'Blackjack win');
				}
				activeGames.delete(game.userId);
				const newBal = await econ.getBalance(game.guildId, game.userId);
				try {
					await msg.edit(buildResultView(game, config, settlement, newBal));
				} catch { /* ignore */ }
				return;
			}

			return startPlay(msg);
		}
	},
};

// ── Game buttons ────────────────────────────────────────
function gameButtons(game) {
	const h = game.playerHands[game.currentHand];
	if (!h || game.phase !== 'playing') return [];

	const canD = game.canDouble(game.currentHand);
	const canSp = game.canSplit(game.currentHand);
	const canSu = game.canSurrender();

	// Split aces auto-stand — advance without showing buttons
	if (game.splitAces) {
		return advanceHand(game);
	}

	// If current hand is bust or 21, auto-advance
	const v = calcValue(h);
	if (v >= 21) {
		return advanceHand(game);
	}

	return [
		new ActionRowBuilder().addComponents(
			btn('bj_hit', '👆 Hit', ButtonStyle.Primary),
			btn('bj_stand', '✋ Stand', ButtonStyle.Secondary),
			btn('bj_double', '💰 Double', ButtonStyle.Success, !canD),
			btn('bj_split', '✂️ Split', ButtonStyle.Primary, !canSp),
			btn('bj_surrender', '🏳️ Surrender', ButtonStyle.Danger, !canSu),
		),
	];
}

function advanceHand(game) {
	// Move to next hand or dealer turn
	game.currentHand++;
	if (game.currentHand >= game.playerHands.length) {
		// All hands resolved — dealer's turn
		game.phase = 'dealer';
		game.dealerPlay();
		game.phase = 'done';
		return []; // No more buttons
	}
	return gameButtons(game); // Recurse for next hand
}

// ── Button collector ────────────────────────────────────
function attachCollector(msg, game) {
	const filter = (i) => i.user.id === game.userId;

	const collector = msg.createMessageComponentCollector({
		filter,
		componentType: ComponentType.Button,
		time: 120_000,
	});

	collector.on('collect', async (interaction) => {
		const g = activeGames.get(game.userId);
		if (!g || g.phase !== 'playing') {
			const stale = new ContainerBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent('🎴 This game is no longer active.'),
			);
			await interaction.update({ components: [stale], flags: MessageFlags.IsComponentsV2 });
			collector.stop();
			return;
		}

		const econ = interaction.client.db.economy;
		const config = await econ.getConfig(g.guildId);
		const handIdx = g.currentHand;
		const hand = g.playerHands[handIdx];

		switch (interaction.customId) {
			case 'bj_hit': {
				hand.push(draw(g.deck));
				const v = calcValue(hand);
				if (v > 21 || v === 21) {
					// Hand done — advance
					const buttons = advanceHand(g);
					if (g.phase === 'done') {
						// All done — settle
						await interaction.update(buildGameView(g, config, { gameOver: true }));
						await settleAndShow(msg, g, config);
						collector.stop();
					} else {
						await interaction.update(buildGameView(g, config, { buttons }));
					}
				} else {
					await interaction.update(buildGameView(g, config, { buttons: gameButtons(g) }));
				}
				break;
			}

			case 'bj_stand': {
				const buttons = advanceHand(g);
				if (g.phase === 'done') {
					await interaction.update(buildGameView(g, config, { gameOver: true }));
					await settleAndShow(msg, g, config);
					collector.stop();
				} else {
					await interaction.update(buildGameView(g, config, { buttons }));
				}
				break;
			}

			case 'bj_double': {
				if (!g.canDouble(handIdx)) {
					await interaction.reply({ content: "You can't double down now.", ephemeral: true });
					return;
				}
				const bal = await econ.getBalance(g.guildId, g.userId);
				if (bal < g.bet) {
					await interaction.reply({ content: "You don't have enough to double down.", ephemeral: true });
					return;
				}
				await econ.removeBalance(g.guildId, g.userId, g.bet, 'blackjack', 'Double down');
				g.double(handIdx);
				// Hand is done after double (one card only)
				const buttons = advanceHand(g);
				if (g.phase === 'done') {
					await interaction.update(buildGameView(g, config, { gameOver: true }));
					await settleAndShow(msg, g, config);
					collector.stop();
				} else {
					await interaction.update(buildGameView(g, config, { buttons }));
				}
				break;
			}

			case 'bj_split': {
				if (!g.canSplit(handIdx)) {
					await interaction.reply({ content: "You can't split this hand.", ephemeral: true });
					return;
				}
				const bal = await econ.getBalance(g.guildId, g.userId);
				if (bal < g.bet) {
					await interaction.reply({ content: "You don't have enough to split.", ephemeral: true });
					return;
				}
				await econ.removeBalance(g.guildId, g.userId, g.bet, 'blackjack', 'Split hand');
				g.split(handIdx);

				if (g.splitAces) {
					// Split aces — auto-stand all hands, resolve immediately
					while (g.phase === 'playing') advanceHand(g);
					await interaction.update(buildGameView(g, config, { gameOver: true }));
					await settleAndShow(msg, g, config);
					collector.stop();
				} else {
					await interaction.update(buildGameView(g, config, { buttons: gameButtons(g) }));
				}
				break;
			}

			case 'bj_surrender': {
				if (!g.canSurrender()) {
					await interaction.reply({ content: "You can't surrender now.", ephemeral: true });
					return;
				}
				g.surrendered = true;
				g.phase = 'done';
				const refund = Math.floor(g.bet / 2);
				if (refund > 0) {
					await econ.addBalance(g.guildId, g.userId, refund, 'blackjack', 'Surrender refund');
				}
				activeGames.delete(g.userId);
				const newBal = await econ.getBalance(g.guildId, g.userId);
				const settlement = settleGame(g);
				try {
					await interaction.update(buildResultView(g, config, settlement, newBal));
				} catch { /* ignore */ }
				collector.stop();
				break;
			}
		}
	});

	collector.on('end', async (collected, reason) => {
		if (reason === 'time') {
			const g = activeGames.get(game.userId);
			if (g && g.phase === 'playing') {
				// Auto-stand on timeout
				g.phase = 'dealer';
				g.dealerPlay();
				g.phase = 'done';
				const config = await msg.client.db.economy.getConfig(g.guildId);
				await settleAndShow(msg, g, config);
			}
		}
	});
}

// ── Settle and display final result ─────────────────────
async function settleAndShow(msg, game, config) {
	const settlement = settleGame(game);

	if (settlement.totalPayout > 0) {
		await msg.client.db.economy.addBalance(
			game.guildId, game.userId,
			settlement.totalPayout,
			'blackjack',
			'Blackjack result',
		);
	}

	activeGames.delete(game.userId);

	const newBal = await msg.client.db.economy.getBalance(game.guildId, game.userId);

	try {
		await msg.edit(buildResultView(game, config, settlement, newBal));
	} catch { /* message might be deleted */ }
}
