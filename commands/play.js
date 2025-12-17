const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const play = require("play-dl");
const {
    isSpotifyUrl,
    parseSpotifyUrl,
    getSpotifyTrack,
    getSpotifyAlbum,
    getSpotifyPlaylist,
} = require("../utils/spotify");
const { getQueue } = require("../utils/musicQueue");
const { playSong, connectToChannel } = require("../utils/musicPlayer");

async function searchAndCreateSong(query, spotifyData, requestedBy) {
    try {
        const searched = await play.search(query, { limit: 1 });

        if (!searched || searched.length === 0) {
            console.log(`No results for: ${query}`);
            return null;
        }

        const video = searched[0];

        // Validasi video memiliki URL
        if (!video || !video.url) {
            console.log(`Invalid video result for: ${query}`);
            return null;
        }

        console.log(`Found: ${video.title} | URL: ${video.url}`);

        return {
            title: spotifyData?.title || video.title || "Unknown",
            artist: spotifyData?.artist || video.channel?.name || "Unknown",
            duration: spotifyData?.duration || video.durationRaw || "0:00",
            thumbnail:
                spotifyData?.thumbnail || video.thumbnails?.[0]?.url || null,
            url: video.url,
            requestedBy,
        };
    } catch (error) {
        console.error(`Search error for "${query}":`, error);
        return null;
    }
}

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

        const query = interaction.options.getString("query");
        const queue = getQueue(interaction.guild.id);

        try {
            // Connect to voice channel if not connected
            if (!queue.connection) {
                await connectToChannel(
                    voiceChannel,
                    interaction.channel,
                    interaction.guild.id
                );
            }

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
                        .setDescription(
                            "Gagal mengambil data dari Spotify. Pastikan SPOTIFY_CLIENT_ID dan SPOTIFY_CLIENT_SECRET sudah diset."
                        );
                    return interaction.editReply({ embeds: [embed] });
                }

                // Add first track
                const firstTrack = spotifyTracks[0];
                const firstSong = await searchAndCreateSong(
                    firstTrack.query,
                    firstTrack,
                    interaction.user.id
                );

                if (!firstSong) {
                    const embed = new EmbedBuilder()
                        .setColor("#ed4245")
                        .setDescription("Lagu tidak ditemukan di YouTube.");
                    return interaction.editReply({ embeds: [embed] });
                }

                queue.songs.push(firstSong);

                // Add remaining tracks to queue (for album/playlist)
                if (spotifyTracks.length > 1) {
                    const embed = new EmbedBuilder()
                        .setColor("#1DB954")
                        .setDescription(
                            `Adding **${spotifyTracks.length}** tracks to queue...`
                        );
                    await interaction.editReply({ embeds: [embed] });

                    for (let i = 1; i < spotifyTracks.length; i++) {
                        const track = spotifyTracks[i];
                        const song = await searchAndCreateSong(
                            track.query,
                            track,
                            interaction.user.id
                        );
                        if (song) queue.songs.push(song);
                    }

                    const doneEmbed = new EmbedBuilder()
                        .setColor("#1DB954")
                        .setDescription(
                            `Added **${queue.songs.length}** tracks to queue!`
                        );
                    await interaction.editReply({ embeds: [doneEmbed] });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor("#1DB954")
                        .setDescription(`Playing **${firstSong.title}**`);
                    await interaction.editReply({ embeds: [embed] });
                }

                if (!queue.playing) {
                    playSong(interaction.guild.id, queue.songs[0]);
                }

                return;
            }

            // Handle regular search query
            const song = await searchAndCreateSong(
                query,
                null,
                interaction.user.id
            );

            if (!song) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Lagu tidak ditemukan.");
                return interaction.editReply({ embeds: [embed] });
            }

            queue.songs.push(song);

            if (!queue.playing) {
                playSong(interaction.guild.id, song);
                const embed = new EmbedBuilder()
                    .setColor("#1DB954")
                    .setDescription(`Playing **${song.title}**`);
                return interaction.editReply({ embeds: [embed] });
            } else {
                const embed = new EmbedBuilder()
                    .setColor("#5865f2")
                    .setTitle("Added to Queue")
                    .setDescription(`**${song.title}**`)
                    .setThumbnail(song.thumbnail)
                    .addFields(
                        { name: "Artist", value: song.artist, inline: true },
                        {
                            name: "Duration",
                            value: song.duration,
                            inline: true,
                        },
                        {
                            name: "Position",
                            value: `#${queue.songs.length}`,
                            inline: true,
                        }
                    );
                return interaction.editReply({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Play error:", error);
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Terjadi error saat memutar lagu.");
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
