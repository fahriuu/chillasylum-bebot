const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");
const {
    isSpotifyUrl,
    parseSpotifyUrl,
    getSpotifyTrack,
    getSpotifyAlbum,
    getSpotifyPlaylist,
    getSpotifyArtistTopTracks,
    getPlaylistInfo,
} = require("../utils/spotify");

// Helper: truncate text
function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

// Helper: format duration
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Putar lagu dari Spotify atau YouTube")
        .addStringOption((option) =>
            option
                .setName("judul")
                .setDescription("Judul lagu atau link Spotify/YouTube")
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

        // Check if bot is already in a different voice channel
        let player = kazagumo.players.get(interaction.guild.id);

        // Clean up invalid/stuck player
        if (player && !player.voiceId) {
            try {
                player.destroy();
            } catch (e) {
                // Ignore
            }
            player = null;
        }

        if (player && player.voiceId !== voiceChannel.id) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Bot sedang digunakan di <#${player.voiceId}>. Join channel tersebut untuk request lagu.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const query = interaction.options.getString("judul");

        try {
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
                let playlistInfo = null;

                if (parsed.type === "track") {
                    const track = await getSpotifyTrack(parsed.id);
                    if (track) spotifyTracks = [track];
                } else if (parsed.type === "album") {
                    spotifyTracks = (await getSpotifyAlbum(parsed.id)) || [];
                    playlistInfo = await getPlaylistInfo(parsed.id, "album");
                } else if (parsed.type === "playlist") {
                    spotifyTracks = (await getSpotifyPlaylist(parsed.id)) || [];
                    playlistInfo = await getPlaylistInfo(parsed.id, "playlist");
                } else if (parsed.type === "artist") {
                    const artistData = await getSpotifyArtistTopTracks(
                        parsed.id
                    );
                    if (artistData) {
                        spotifyTracks = artistData.tracks;
                        playlistInfo = {
                            name: `${artistData.artistInfo.name} - Top Tracks`,
                            thumbnail: artistData.artistInfo.thumbnail,
                        };
                    }
                }

                if (spotifyTracks.length === 0) {
                    const embed = new EmbedBuilder()
                        .setColor("#ed4245")
                        .setDescription(
                            "Gagal mengambil data dari Spotify. Playlist mungkin private."
                        );
                    return interaction.editReply({ embeds: [embed] });
                }

                // Get starting position in queue before adding
                const startPosition = player.queue.length;

                // Add all tracks to queue
                let addedCount = 0;
                for (const spotifyTrack of spotifyTracks) {
                    const result = await kazagumo.search(spotifyTrack.query, {
                        requester: interaction.user,
                    });
                    if (result.tracks.length > 0) {
                        const track = result.tracks[0];
                        track.source = "spotify"; // Mark as Spotify source
                        player.queue.add(track);
                        addedCount++;
                    }
                }

                if (!player.playing && !player.paused) {
                    try {
                        await player.play();
                    } catch (e) {
                        console.error("Play error:", e.message);
                    }
                }

                // Build track list with actual queue position
                const trackList = spotifyTracks
                    .slice(0, 10)
                    .map((t, i) => {
                        const title = truncate(t.title, 30);
                        const artist = truncate(t.artist, 20);
                        const queuePos = startPosition + i + 1;
                        return `\`${String(queuePos).padStart(
                            2,
                            " "
                        )}.\` ${title} • ${artist} \`${t.duration}\``;
                    })
                    .join("\n");

                const remaining = spotifyTracks.length - 10;
                const moreText =
                    remaining > 0 ? `\n\n\`+${remaining} more tracks\`` : "";

                const embed = new EmbedBuilder()
                    .setColor("#1DB954")
                    .setAuthor({ name: "Added to Queue" })
                    .setTitle(playlistInfo?.name || "Playlist")
                    .setURL(query)
                    .setDescription(`${trackList}${moreText}`)
                    .setThumbnail(
                        playlistInfo?.thumbnail || spotifyTracks[0]?.thumbnail
                    )
                    .setFooter({
                        text: `${addedCount} tracks • Requested by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL(),
                    })
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            }

            // Handle regular search
            const result = await kazagumo.search(query, {
                requester: interaction.user,
            });

            if (!result.tracks.length) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Lagu tidak ditemukan.");
                return interaction.editReply({ embeds: [embed] });
            }

            const track = result.tracks[0];
            // Detect source from query or URI
            if (query.includes("youtube.com") || query.includes("youtu.be")) {
                track.source = "youtube";
            } else if (query.includes("spotify.com")) {
                track.source = "spotify";
            } else {
                track.source = "youtube"; // Default search goes to YouTube
            }
            player.queue.add(track);

            const isPlaying = player.playing || player.paused;
            if (!isPlaying) {
                try {
                    await player.play();
                } catch (e) {
                    console.error("Play error:", e.message);
                }
            }

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setAuthor({
                    name: isPlaying ? " Added to Queue" : "🎵 Now Playing",
                })
                .setTitle(truncate(track.title, 50))
                .setURL(track.uri)
                .setThumbnail(track.thumbnail || null)
                .setDescription(`by **${track.author || "Unknown"}**`)
                .addFields(
                    {
                        name: "Duration",
                        value: `\`${formatDuration(track.length)}\``,
                        inline: true,
                    },
                    {
                        name: "Position",
                        value: `\`#${player.queue.length}\``,
                        inline: true,
                    }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
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
