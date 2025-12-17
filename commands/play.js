const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");
const {
    isSpotifyUrl,
    parseSpotifyUrl,
    getSpotifyTrack,
    getSpotifyAlbum,
    getSpotifyPlaylist,
} = require("../utils/spotify");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Putar lagu dari Spotify atau YouTube")
        .addStringOption((option) =>
            option
                .setName("query")
                .setDescription("Link Spotify/YouTube atau judul lagu")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Kamu harus join voice channel dulu!");
            return interaction.editReply({ embeds: [embed] });
        }

        const kazagumo = getKazagumo();
        if (!kazagumo) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Music system belum siap. Coba lagi nanti.");
            return interaction.editReply({ embeds: [embed] });
        }

        let query = interaction.options.getString("query");
        let searchQuery = query;

        try {
            // Handle Spotify URL
            if (isSpotifyUrl(query)) {
                const parsed = parseSpotifyUrl(query);
                if (!parsed) {
                    const embed = new EmbedBuilder()
                        .setColor("#ed4245")
                        .setDescription("Link Spotify tidak valid.");
                    return interaction.editReply({ embeds: [embed] });
                }

                let spotifyTracks = [];

                if (parsed.type === "track") {
                    const track = await getSpotifyTrack(parsed.id);
                    if (track) spotifyTracks = [track];
                } else if (parsed.type === "album") {
                    spotifyTracks = (await getSpotifyAlbum(parsed.id)) || [];
                } else if (parsed.type === "playlist") {
                    spotifyTracks = (await getSpotifyPlaylist(parsed.id)) || [];
                }

                if (spotifyTracks.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor("#ed4245")
                        .setDescription("Gagal mengambil data dari Spotify.");
                    return interaction.editReply({ embeds: [embed] });
                }

                // Use first track's query for search
                searchQuery = spotifyTracks[0].query;
            }

            // Create or get player
            let player = kazagumo.players.get(interaction.guild.id);

            if (!player) {
                player = await kazagumo.createPlayer({
                    guildId: interaction.guild.id,
                    textId: interaction.channel.id,
                    voiceId: voiceChannel.id,
                    volume: 100,
                    deaf: true,
                });
            }

            player.data.set("textChannel", interaction.channel);

            // Search for track
            const result = await kazagumo.search(searchQuery, {
                requester: interaction.user,
            });

            if (!result.tracks.length) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Lagu tidak ditemukan.");
                return interaction.editReply({ embeds: [embed] });
            }

            const track = result.tracks[0];
            player.queue.add(track);

            if (!player.playing && !player.paused) {
                player.play();
            }

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setTitle(player.playing ? "Added to Queue" : "Now Playing")
                .setDescription(`**${track.title}**`)
                .setThumbnail(track.thumbnail || null)
                .addFields(
                    {
                        name: "Artist",
                        value: track.author || "Unknown",
                        inline: true,
                    },
                    {
                        name: "Duration",
                        value: formatDuration(track.length),
                        inline: true,
                    },
                    {
                        name: "Position",
                        value: `#${player.queue.length || 1}`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Play error:", error);
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Terjadi error saat memutar lagu.");
            return interaction.editReply({ embeds: [embed] });
        }
    },
};

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
