const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("Lihat semua commands yang tersedia"),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor("#1DB954")
            .setAuthor({
                name: "BeBot Help",
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .setDescription("Berikut adalah daftar commands yang tersedia:")
            .addFields(
                {
                    name: " Music Commands",
                    value: [
                        "`/play` - Putar lagu dari Spotify/YouTube",
                        "`/random` - Play random musik by genre",
                        "`/skip` - Skip lagu yang sedang diputar",
                        "`/stop` - Stop musik dan keluar dari VC",
                        "`/pause` - Pause lagu",
                        "`/resume` - Lanjutkan lagu yang di-pause",
                        "`/queue` - Lihat antrian lagu",
                        "`/lyrics` - Lirik lagu yang sedang diputar",
                    ].join("\n"),
                },
                {
                    name: "🎲 Random Genres",
                    value: "Pop, HipHop, Rock, EDM, Jazz, Kpop, Metal, Acoustic, Classical, Indie, RnB, Lofi",
                },
                {
                    name: "💰 Economy Commands",
                    value: [
                        "`/balance` - Cek saldo kamu",
                        "`/daily` - Klaim bonus harian",
                        "`/work` - Kerja untuk dapat uang",
                        "`/leaderboard` - Lihat ranking terkaya",
                    ].join("\n"),
                },
                {
                    name: "🎮 Fun Commands",
                    value: [
                        "`/ping` - Cek latency bot",
                        "`/avatar` - Lihat avatar user",
                        "`/userinfo` - Info tentang user",
                        "`/ship` - Cek kecocokan 2 orang",
                        "`/kerangajaib` - Tanya kerang ajaib",
                        "`/quote` - Random quote inspiratif",
                    ].join("\n"),
                },
                {
                    name: "📌 Supported Links",
                    value: [
                        "• Spotify Track, Album, Playlist, Artist",
                        "• YouTube Video & Search",
                    ].join("\n"),
                }
            )
            .setFooter({
                text: `Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    },
};
