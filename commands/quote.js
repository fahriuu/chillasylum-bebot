const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Fallback quotes jika API gagal
const fallbackQuotes = [
    {
        text: "The only way to do great work is to love what you do.",
        author: "Steve Jobs",
    },
    {
        text: "Innovation distinguishes between a leader and a follower.",
        author: "Steve Jobs",
    },
    { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
    {
        text: "Life is what happens when you're busy making other plans.",
        author: "John Lennon",
    },
    {
        text: "The future belongs to those who believe in the beauty of their dreams.",
        author: "Eleanor Roosevelt",
    },
    {
        text: "It is during our darkest moments that we must focus to see the light.",
        author: "Aristotle",
    },
    {
        text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
        author: "Winston Churchill",
    },
    {
        text: "Believe you can and you're halfway there.",
        author: "Theodore Roosevelt",
    },
    {
        text: "The best time to plant a tree was 20 years ago. The second best time is now.",
        author: "Chinese Proverb",
    },
    {
        text: "Your time is limited, don't waste it living someone else's life.",
        author: "Steve Jobs",
    },
    {
        text: "In the middle of difficulty lies opportunity.",
        author: "Albert Einstein",
    },
    {
        text: "It does not matter how slowly you go as long as you do not stop.",
        author: "Confucius",
    },
    {
        text: "The way to get started is to quit talking and begin doing.",
        author: "Walt Disney",
    },
    {
        text: "The secret of getting ahead is getting started.",
        author: "Mark Twain",
    },
    {
        text: "Creativity is intelligence having fun.",
        author: "Albert Einstein",
    },
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("quote")
        .setDescription("Random quote inspiratif"),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const res = await fetch(
                "https://quotes.liupurnomo.com/api/quotes/random"
            );
            const data = await res.json();

            // Handle response format - data is nested in data.data
            const quoteData = data.data || data;
            const quote = quoteData.text || quoteData.quote;
            const author = quoteData.author || "Unknown";

            if (quote) {
                const embed = new EmbedBuilder()
                    .setColor("#5865F2")
                    .setDescription(`*"${quote}"*`)
                    .setFooter({ text: `— ${author}` });
                return interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Quote API error:", error.message);
        }

        // Fallback to local quotes
        const randomQuote =
            fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
        const embed = new EmbedBuilder()
            .setColor("#5865F2")
            .setDescription(`*"${randomQuote.text}"*`)
            .setFooter({ text: `— ${randomQuote.author}` });

        return interaction.editReply({ embeds: [embed] });
    },
};
