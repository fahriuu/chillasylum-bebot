const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lyrics")
        .setDescription("Cari lirik lagu yang sedang diputar atau berdasarkan judul")
        .addStringOption((option) =>
            option
                .setName("judul")
                .setDescription("Judul lagu (kosongkan untuk lagu yang sedang diputar)")
                .setRequired(false),
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const inputQuery = interaction.options.getString("judul");
        let searchQuery = "";
        let displayTitle = "";

        if (inputQuery) {
            // User provided a title or URL
            if (inputQuery.includes("spotify.com") || inputQuery.includes("youtube.com") || inputQuery.includes("youtu.be")) {
                // It's a URL — try to extract title from currently playing or just use as-is
                // Clean URL to get readable text isn't useful, so just tell user
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Untuk cari lirik, gunakan judul lagu langsung.\nContoh: `/lyrics judul: Shape of You`");
                return interaction.editReply({ embeds: [embed] });
            }
            searchQuery = inputQuery.trim();
            displayTitle = searchQuery;
        } else {
            // No input — use currently playing track
            const kazagumo = getKazagumo();
            const player = kazagumo?.players.get(interaction.guild.id);

            if (!player || !player.queue.current) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Tidak ada lagu yang sedang diputar.\nGunakan `/lyrics judul: nama lagu` untuk cari lirik.");
                return interaction.editReply({ embeds: [embed] });
            }

            const current = player.queue.current;

            // Clean title - remove noise words
            let cleanTitle = current.title
                .replace(/\(.*?\)|\[.*?\]/g, "")
                .replace(/\|.*/g, "")
                .replace(/#\w+/g, "")
                .replace(/official\s*(video|audio|mv|music video)?/gi, "")
                .replace(/feat\.?|ft\.?/gi, "")
                .replace(/\s*-\s*/g, " ")
                .replace(/&/g, " ")
                .replace(/\s+/g, " ")
                .trim();

            // Extract artist from author
            let artist = current.author
                .replace(/\s*-?\s*(topic|official|vevo|music)$/gi, "")
                .replace(/\s+/g, " ")
                .trim();

            let songName = cleanTitle.split(" ").slice(0, 6).join(" ");
            searchQuery = `${songName} ${artist}`;
            displayTitle = `${current.title} - ${current.author}`;
        }

        try {
            // Use lrclib.net API (free, good coverage)
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();

            if (!searchData || searchData.length === 0) {
                // Retry with shorter query (just first 3 words)
                const shortQuery = searchQuery.split(" ").slice(0, 3).join(" ");
                if (shortQuery !== searchQuery) {
                    const retryUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(shortQuery)}`;
                    const retryRes = await fetch(retryUrl);
                    const retryData = await retryRes.json();

                    if (retryData && retryData.length > 0) {
                        return sendLyrics(interaction, retryData, searchQuery, displayTitle);
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription(`Lirik tidak ditemukan untuk: **${displayTitle || searchQuery}**`);
                return interaction.editReply({ embeds: [embed] });
            }

            return sendLyrics(interaction, searchData, searchQuery, displayTitle);
        } catch (error) {
            console.error("Lyrics error:", error);
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Gagal mencari lirik. Coba lagi nanti.");
            return interaction.editReply({ embeds: [embed] });
        }
    },
};

function sendLyrics(interaction, searchData, searchQuery, displayTitle) {
    // Extract artist from search query for matching
    const queryWords = searchQuery.toLowerCase().split(" ");

    // Find best match - prioritize matching more words from query
    let song = searchData.find(
        (s) =>
            (s.plainLyrics || s.syncedLyrics) &&
            queryWords.some(w => s.artistName.toLowerCase().includes(w)) &&
            queryWords.some(w => s.trackName.toLowerCase().includes(w))
    );

    // Fallback: match artist only
    if (!song) {
        song = searchData.find(
            (s) =>
                (s.plainLyrics || s.syncedLyrics) &&
                queryWords.some(w => s.artistName.toLowerCase().includes(w))
        );
    }

    // Fallback: first result with lyrics
    if (!song) {
        song = searchData.find((s) => s.plainLyrics || s.syncedLyrics);
    }

    if (!song) {
        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setDescription(`Lirik tidak ditemukan untuk: **${displayTitle || searchQuery}**`);
        return interaction.editReply({ embeds: [embed] });
    }

    let lyrics =
        song.plainLyrics ||
        song.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, "").trim();

    if (!lyrics) {
        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setDescription(`Lirik tidak ditemukan untuk: **${song.trackName}**`);
        return interaction.editReply({ embeds: [embed] });
    }

    // Truncate if too long (Discord embed limit)
    if (lyrics.length > 4000) {
        lyrics = lyrics.substring(0, 4000) + "\n\n... (lirik terpotong)";
    }

    const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setAuthor({ name: "🎵 Lyrics" })
        .setTitle(`${song.trackName} - ${song.artistName}`)
        .setDescription(lyrics)
        .setFooter({
            text: `Requested by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
        });

    return interaction.editReply({ embeds: [embed] });
}
