import { Client, GatewayIntentBits, PermissionsBitField } from 'discord.js';

import axios from 'axios';



const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = "";
const NEWS_API_KEY ="";

client.once('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.toLowerCase() === '!hello') {
        if (message.guild) {
            const botMember = await message.guild.members.fetch(client.user!.id);
            if (!botMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('I need admin permissions to function properly!');
            }
        }
        await message.reply('Hello, world!');
    }

    if (message.content.toLowerCase() === '$hi') {
        await message.reply('Hello World');
    }

    if (message.content.toLowerCase() === '$news') {
        try {
            // Call the News API
            const response = await axios.get('https://newsapi.org/v2/top-headlines', {
                params: {
                    country: 'us',          // US news
                    apiKey: NEWS_API_KEY    // Your API key
                }
            });

            // Get the first 5 headlines
            const headlines = response.data.articles.slice(0, 5).map((article: any) => article.title).join('\n');
            
            if (headlines) {
                await message.reply(`Latest headlines from US:\n${headlines}`);
            } else {
                await message.reply('Could not fetch news at the moment.');
            }
        } catch (error) {
            console.error('Error fetching news:', error);
            await message.reply('Failed to retrieve news. Please try again later.');
        }
    }
});

client.login(TOKEN);
