import { Client, GatewayIntentBits } from 'discord.js';
import axios from 'axios';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = 'MTM1NzQwMzUxMTk1NjE3NzA1OQ.GiyR8Y.KcnanSKwDxTRIKocwgkNL_JNwZ4OABYZWMX3wU';
const NEWS_API_KEY = '681ecd200af343f3be867105f6081058';

interface GameState {
    playerId: string;
    difficulty: 'easy' | 'hard';
    deck: string[];
    playerHand: string[];
    botHand: string[];
    communityCards: string[];
    phase: 'flop' | 'turn' | 'river' | 'showdown';
    pot: number;
    playerChips: number;
    botChips: number;
    currentBet: number;
    playerHasFolded: boolean;
}

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const rankValue: { [key: string]: number } = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
    '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const createDeck = () => ranks.flatMap(rank => suits.map(suit => `${rank}${suit}`));
const shuffle = (deck: string[]) => {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
};
const draw = (deck: string[], n: number) => deck.splice(0, n);
const activeGames: Map<string, GameState> = new Map();

function getHandRank(cards: string[]): { score: number, description: string } {
    const counts: { [key: string]: number } = {};
    const values = cards.map(c => c.replace(/[^0-9AJQK]/g, ''));
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const pairs = Object.values(counts).filter(c => c === 2).length;
    const threes = Object.values(counts).filter(c => c === 3).length;

    if (threes) return { score: 4, description: 'Three of a Kind' };
    if (pairs === 2) return { score: 3, description: 'Two Pair' };
    if (pairs === 1) return { score: 2, description: 'One Pair' };

    const highCard = Math.max(...values.map(v => rankValue[v]));
    return { score: 1, description: `High Card (${Object.keys(rankValue).find(k => rankValue[k] === highCard)})` };
}

function compareHands(player: string[], bot: string[], community: string[]): string {
    const playerFull = [...player, ...community];
    const botFull = [...bot, ...community];

    const playerRank = getHandRank(playerFull);
    const botRank = getHandRank(botFull);

    if (playerRank.score > botRank.score) return 'player';
    if (botRank.score > playerRank.score) return 'bot';

    // If tie, compare high card
    const getHigh = (cards: string[]) => Math.max(...cards.map(c => rankValue[c.replace(/[^0-9AJQK]/g, '')]));
    const playerHigh = getHigh(playerFull);
    const botHigh = getHigh(botFull);

    if (playerHigh > botHigh) return 'player';
    if (botHigh > playerHigh) return 'bot';
    return 'tie';
}

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    if (content === '$hi') {
        return message.reply('Hello World');
    }

    if (content === '$news') {
        try {
            const response = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: { country: 'us', apiKey: NEWS_API_KEY }
            });
            const headlines = response.data.articles
                .slice(0, 5)
                .map((article: any) => article.title)
                .join('\n');
            return message.reply(`📰 Top Headlines:\n${headlines}`);
        } catch {
            return message.reply('Could not fetch news.');
        }
    }


    //poker

    if (content.startsWith('$poker')) {
        const args = message.content.trim().split(/\s+/);
        const difficulty = args[1]?.toLowerCase();
        if (!['easy', 'hard'].includes(difficulty)) {
            return message.reply('Start with `$poker easy` or `$poker hard`');
        }

        const deck = shuffle(createDeck());
        const playerHand = draw(deck, 2);
        const botHand = draw(deck, 2);
        const communityCards = draw(deck, 3); // Flop

        const game: GameState = {
            playerId: message.author.id,
            difficulty: difficulty as 'easy' | 'hard',
            deck,
            playerHand,
            botHand,
            communityCards,
            phase: 'flop',
            pot: 20,
            playerChips: 1000,
            botChips: 1000,
            currentBet: 10,
            playerHasFolded: false
        };

        activeGames.set(message.author.id, game);

        return message.reply(
            `🃏 **Texas Hold'em (${difficulty.toUpperCase()})**\n` +
            `**Your Hand:** ${playerHand.join(' ')}\n` +
            `**Community Cards:** ${communityCards.join(' ')}\n` +
            `Pot: 💰 ${game.pot} | Your Chips: ${game.playerChips}\n` +
            `Type \`$call\`, \`$raise <amount>\`, or \`$fold\` to continue.`
        );
    }

    if (content.startsWith('$call')) {
        const game = activeGames.get(message.author.id);
        if (!game || game.phase === 'showdown') return;

        game.playerChips -= game.currentBet;
        game.pot += game.currentBet;

        if (game.difficulty === 'hard' && Math.random() > 0.7) {
            const raise = 50;
            game.botChips -= raise;
            game.pot += raise;
            game.currentBet = raise;
            await message.reply(`🤖 Bot raises by ${raise}!`);
        }

        if (game.phase === 'flop') {
            game.communityCards.push(...draw(game.deck, 1)); // Turn
            game.phase = 'turn';
        } else if (game.phase === 'turn') {
            game.communityCards.push(...draw(game.deck, 1)); // River
            game.phase = 'river';
        } else {
            game.phase = 'showdown';
        }

        if (game.phase !== 'showdown') {
            return message.reply(
                `**Community Cards:** ${game.communityCards.join(' ')}\n` +
                `Pot: 💰 ${game.pot} | Your Chips: ${game.playerChips}\n` +
                `Type \`$call\`, \`$raise <amount>\`, or \`$fold\``
            );
        }

        const winner = compareHands(game.playerHand, game.botHand, game.communityCards);
        const winMsg = winner === 'player' ? '🎉 You win the pot!' :
                       winner === 'bot' ? '🤖 Bot wins the pot.' : '🤝 It’s a tie!';
        activeGames.delete(message.author.id);
        return message.reply(
            `**Showdown!**\n` +
            `Your Hand: ${game.playerHand.join(' ')}\n` +
            `Bot Hand: ${game.botHand.join(' ')}\n` +
            `Community: ${game.communityCards.join(' ')}\n\n➡️ ${winMsg}`
        );
    }

    if (content.startsWith('$raise')) {
        const game = activeGames.get(message.author.id);
        if (!game || game.phase === 'showdown') return;

        const raiseAmount = parseInt(message.content.split(' ')[1]);
        if (isNaN(raiseAmount) || raiseAmount <= 0) {
            return message.reply('Invalid raise amount.');
        }

        game.playerChips -= raiseAmount;
        game.pot += raiseAmount;
        game.currentBet = raiseAmount;

        if (game.difficulty === 'easy') {
            game.botChips -= raiseAmount;
            game.pot += raiseAmount;
            await message.reply(`🤖 Bot calls your raise of ${raiseAmount}.`);
        } else {
            const botRaise = raiseAmount + 20;
            game.botChips -= botRaise;
            game.pot += botRaise;
            game.currentBet = botRaise;
            await message.reply(`🤖 Bot re-raises to ${botRaise}!`);
        }

        return message.reply(`You raised by ${raiseAmount}. Pot is now 💰 ${game.pot}. Type \`$call\` or \`$fold\`.`);
    }

    if (content === '$fold') {
        const game = activeGames.get(message.author.id);
        if (!game) return;

        activeGames.delete(message.author.id);
        return message.reply('😞 You folded. 🤖 Bot wins the pot.');
    }


    //black jack

    interface BlackjackGame {
        playerId: string;
        playerHand: string[];
        botHand: string[];
        deck: string[];
        playerStood: boolean;
        finished: boolean;
    }
    
    const blackjackGames: Map<string, BlackjackGame> = new Map();
    
    function getHandValue(hand: string[]): number {
        let value = 0;
        let aces = 0;
    
        for (const card of hand) {
            const rank = card.slice(0, -1);
            if (['J', 'Q', 'K'].includes(rank)) {
                value += 10;
            } else if (rank === 'A') {
                aces += 1;
                value += 11;
            } else {
                value += parseInt(rank);
            }
        }
    
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }
    
        return value;
    }
    
    function drawCard(deck: string[]): string {
        return deck.splice(0, 1)[0];
    }
    
    // Start Blackjack
    if (message.content.toLowerCase() === '$blackjack') {
        const deck = shuffle(createDeck());
        const playerHand = [drawCard(deck), drawCard(deck)];
        const botHand = [drawCard(deck)];
    
        const game: BlackjackGame = {
            playerId: message.author.id,
            playerHand,
            botHand,
            deck,
            playerStood: false,
            finished: false
        };
    
        blackjackGames.set(message.author.id, game);
    
        const value = getHandValue(playerHand);
        return message.reply(
            `🃏 **Blackjack**\n\nYour hand: ${playerHand.join(' ')} (Total: ${value})\nDealer shows: ${botHand[0]}\n\nType \`$hit\` or \`$stand\`.`
        );
    }
    
    // Hit
    if (message.content.toLowerCase() === '$hit') {
        const game = blackjackGames.get(message.author.id);
        if (!game || game.finished) return;
    
        game.playerHand.push(drawCard(game.deck));
        const value = getHandValue(game.playerHand);
    
        if (value > 21) {
            game.finished = true;
            return message.reply(
                `💥 You busted with ${value}!\nYour hand: ${game.playerHand.join(' ')}\n\nDealer wins.`
            );
        }
    
        return message.reply(
            `Your hand: ${game.playerHand.join(' ')} (Total: ${value})\nType \`$hit\` or \`$stand\`.`
        );
    }
    
    // Stand
    if (message.content.toLowerCase() === '$stand') {
        const game = blackjackGames.get(message.author.id);
        if (!game || game.finished) return;
    
        game.playerStood = true;
    
        // Dealer draws
        while (getHandValue(game.botHand) < 17) {
            game.botHand.push(drawCard(game.deck));
        }
    
        const playerValue = getHandValue(game.playerHand);
        const dealerValue = getHandValue(game.botHand);
        game.finished = true;
    
        let result = '';
        if (dealerValue > 21 || playerValue > dealerValue) {
            result = '🎉 You win!';
        } else if (dealerValue === playerValue) {
            result = '🤝 It\'s a tie!';
        } else {
            result = '😞 Dealer wins.';
        }
    
        return message.reply(
            `**Showdown!**\nYour hand: ${game.playerHand.join(' ')} (${playerValue})\nDealer hand: ${game.botHand.join(' ')} (${dealerValue})\n\n➡️ ${result}`
        );
    }
    
});

client.login(TOKEN);
