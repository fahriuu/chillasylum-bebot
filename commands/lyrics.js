const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lyrics")
        .setDescription("Lirik lagu yang sedang diputar"),

    async execute(interaction) {
        await interaction.deferReply();

        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Tidak ada lagu yang sedang diputar.");
            return interaction.editReply({ embeds: [embed] });
        }

        const current = player.queue.current;

        // Clean title - remove noise words
        let cleanTitle = current.title
            .replace(/\(.*?\)|\[.*?\]/g, "") // Remove (xxx) and [xxx]
            .replace(/\|.*/g, "") // Remove everything after |
            .replace(/official\s*(video|audio|mv|music video)?/gi, "")
            .replace(/\s+/g, " ")
            .trim();

        // Extract artist from author (channel name)
        let artist = current.author
            .replace(/\s*-?\s*(topic|official|vevo|music)$/gi, "")
            .replace(/\s+/g, " ")
            .trim();

        // Build search query: "artist trackname"
        const searchQuery = `${artist} ${cleanTitle}`;

        try {
            // Use lrclib.net API (free, better coverage)
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(
                searchQuery
            )}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (!searchData || searchData.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription(
                        `Lirik tidak ditemukan untuk: **${searchQuery}**`
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            // Find best match - prioritize matching artist name
            const artistLower = artist.toLowerCase();
            let song = searchData.find(
                (s) =>
                    (s.plainLyrics || s.syncedLyrics) &&
                    s.artistName.toLowerCase().includes(artistLower)
            );

            // Fallback to first result with lyrics
            if (!song) {
                song = searchData.find((s) => s.plainLyrics || s.syncedLyrics);
            }

            if (!song) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription(
                        `Lirik tidak ditemukan untuk: **${searchQuery}**`
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            let lyrics =
                song.plainLyrics ||
                song.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();

            if (!lyrics) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription(
                        `Lirik tidak ditemukan untuk: **${song.trackName}**`
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            // Truncate if too long (Discord embed limit)
            if (lyrics.length > 4000) {
                lyrics =
                    lyrics.substring(0, 4000) + "\n\n... (lirik terpotong)";
            }

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setAuthor({ name: "🎤 Lyrics" })
                .setTitle(`${song.trackName} - ${song.artistName}`)
                .setDescription(lyrics)
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                });

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Lyrics error:", error);
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Gagal mencari lirik. Coba lagi nanti.");
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
