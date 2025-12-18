const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// Fallback quotes jika API gagal
const fallbackQuotes = [
    {
        text: "Hidup ini seperti sepeda. Agar tetap seimbang, kamu harus terus bergerak.",
        author: "Albert Einstein",
    },
    {
        text: "Kesuksesan adalah kemampuan untuk pergi dari kegagalan ke kegagalan tanpa kehilangan semangat.",
        author: "Winston Churchill",
    },
    {
        text: "Jangan menunggu. Waktunya tidak akan pernah tepat.",
        author: "Napoleon Hill",
    },
    {
        text: "Satu-satunya cara untuk melakukan pekerjaan hebat adalah mencintai apa yang kamu lakukan.",
        author: "Steve Jobs",
    },
    {
        text: "Masa depan milik mereka yang percaya pada keindahan mimpi-mimpi mereka.",
        author: "Eleanor Roosevelt",
    },
    {
        text: "Di tengah kesulitan terdapat kesempatan.",
        author: "Albert Einstein",
    },
    {
        text: "Tidak masalah seberapa lambat kamu berjalan, asalkan kamu tidak berhenti.",
        author: "Confucius",
    },
    {
        text: "Percayalah kamu bisa dan kamu sudah setengah jalan.",
        author: "Theodore Roosevelt",
    },
    {
        text: "Waktu terbaik menanam pohon adalah 20 tahun lalu. Waktu terbaik kedua adalah sekarang.",
        author: "Pepatah Tiongkok",
    },
    {
        text: "Kreativitas adalah kecerdasan yang sedang bersenang-senang.",
        author: "Albert Einstein",
    },
    {
        text: "Jangan biarkan kemarin mengambil terlalu banyak hari ini.",
        author: "Will Rogers",
    },
    { text: "Rahasia untuk maju adalah memulai.", author: "Mark Twain" },
    {
        text: "Kegagalan adalah bumbu yang memberi rasa pada kesuksesan.",
        author: "Truman Capote",
    },
    {
        text: "Hiduplah seolah kamu akan mati besok. Belajarlah seolah kamu akan hidup selamanya.",
        author: "Mahatma Gandhi",
    },
    {
        text: "Keberanian bukan berarti tidak takut, tapi melangkah meski takut.",
        author: "Nelson Mandela",
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
