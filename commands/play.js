const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

// Helper function to check if URL is Spotify
function isSpotifyUrl(url) {
    return url.includes("open.spotify.com") || url.includes("spotify.com");
}

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

// Helper: create player with retry (handles Bad Request from unstable nodes)
async function createPlayerWithRetry(kazagumo, options, maxRetries = 2) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                // Clean up stale connections before retry
                try {
                    const conn = kazagumo.shoukaku.connections.get(
                        options.guildId,
                    );
                    if (conn) {
                        conn.disconnect();
                        kazagumo.shoukaku.connections.delete(options.guildId);
                    }
                    kazagumo.shoukaku.players.delete(options.guildId);
                    kazagumo.players.delete(options.guildId);
                } catch (e) {
                    // Ignore cleanup errors
                }
                // Wait before retry (increasing delay)
                await new Promise((r) => setTimeout(r, 1500 * attempt));
                console.log(
                    `\uD83D\uDD04 Retry createPlayer attempt ${attempt + 1}/${maxRetries} for guild ${options.guildId}`,
                );
            }
            const player = await kazagumo.createPlayer(options);
            // Small delay to let voice connection fully stabilize
            await new Promise((r) => setTimeout(r, 500));
            return player;
        } catch (error) {
            lastError = error;
            console.error(
                `\u274C createPlayer attempt ${attempt + 1} failed:`,
                error.message,
            );
        }
    }
    throw lastError;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("play")
        .setDescription("Putar lagu dari Spotify atau YouTube")
        .addStringOption((option) =>
            option
                .setName("judul")
                .setDescription("Judul lagu atau link Spotify/YouTube")
                .setRequired(true),
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

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

        // Check if any Lavalink node is connected
        const activeNodes = kazagumo.shoukaku.nodes?.size || 0;
        if (activeNodes === 0) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    "Tidak ada server musik yang terhubung saat ini. Bot sedang mencoba reconnect, coba lagi dalam beberapa detik.",
                );
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
                    `Bot sedang digunakan di <#${player.voiceId}>. Join channel tersebut untuk request lagu.`,
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const query = interaction.options.getString("judul");

        try {
            if (!player) {
                player = await createPlayerWithRetry(kazagumo, {
                    guildId: interaction.guild.id,
                    textId: interaction.channel.id,
                    voiceId: voiceChannel.id,
                    volume: 100,
                    deaf: true,
                });
            }

            player.data.set("textChannel", interaction.channel);

            // Handle Spotify URL - Use Lavalink directly (no Spotify API needed)
            if (isSpotifyUrl(query)) {
                const loadingEmbed = new EmbedBuilder()
                    .setColor("#1DB954")
                    .setDescription(" Tunggu sedang mencari lagu...");
                await interaction.editReply({ embeds: [loadingEmbed] });

                try {
                    // Try to load directly with Lavalink (LavaSrc plugin handles Spotify)
                    const result = await kazagumo.search(query, {
                        requester: interaction.user,
                        engine: "spotify",
                    });

                    if (
                        !result ||
                        !result.tracks ||
                        result.tracks.length === 0
                    ) {
                        const embed = new EmbedBuilder()
                            .setColor("#ed4245")
                            .setDescription(
                                 "Tidak bisa load Spotify link. Coba:\n" +
                                    "1. Pastikan link valid dan public\n" +
                                    "2. Atau search dengan judul lagu saja",
                            );
                        return interaction.editReply({ embeds: [embed] });
                    }

                    // Check if it's a playlist/album (multiple tracks)
                    const isPlaylist = result.tracks.length > 1;

                    if (isPlaylist) {
                        // Add all tracks
                        const startPosition = player.queue.length;
                        result.tracks.forEach((track) => {
                            track.source = "spotify";
                            player.queue.add(track);
                        });

                        if (!player.playing && !player.paused) {
                            await player.play();
                        }

                        // Build track list
                        const trackList = result.tracks
                            .slice(0, 10)
                            .map((t, i) => {
                                const title = truncate(t.title, 30);
                                const artist = truncate(t.author, 20);
                                const queuePos = startPosition + i + 1;
                                const duration = formatDuration(t.length);
                                return `\`${String(queuePos).padStart(2, " ")}.\` ${title} • ${artist} \`${duration}\``;
                            })
                            .join("\n");

                        const remaining = result.tracks.length - 10;
                        const moreText =
                            remaining > 0
                                ? `\n\n\`+${remaining} more tracks\``
                                : "";

                        const embed = new EmbedBuilder()
                            .setColor("#1DB954")
                            .setAuthor({
                                name: "✅ Added to Queue",
                                iconURL:
                                    "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
                            })
                            .setTitle(result.playlistName || "Spotify Playlist")
                            .setURL(query)
                            .setDescription(`${trackList}${moreText}`)
                            .setThumbnail(result.tracks[0]?.thumbnail)
                            .setFooter({
                                text: `${result.tracks.length} tracks • Requested by ${interaction.user.username}`,
                                iconURL: interaction.user.displayAvatarURL(),
                            })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    } else {
                        // Single track
                        const track = result.tracks[0];
                        track.source = "spotify";
                        player.queue.add(track);

                        const isPlaying = player.playing || player.paused;
                        if (!isPlaying) {
                            await player.play();
                        }

                        const embed = new EmbedBuilder()
                            .setColor("#1DB954")
                            .setAuthor({
                                name: isPlaying
                                    ? "Added to Queue"
                                    : "Now Playing",
                                iconURL:
                                    "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
                            })
                            .setTitle(truncate(track.title, 50))
                            .setURL(track.uri)
                            .setThumbnail(track.thumbnail || null)
                            .setDescription(
                                `by **${track.author || "Unknown"}**`,
                            )
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
                                },
                            )
                            .setFooter({
                                text: `Requested by ${interaction.user.username}`,
                                iconURL: interaction.user.displayAvatarURL(),
                            })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    }
                } catch (spotifyError) {
                    console.error(
                        "Lavalink Spotify error:",
                        spotifyError.message,
                    );

                    // Fallback: Try YouTube search with Spotify metadata
                    const embed = new EmbedBuilder()
                        .setColor("#ed4245")
                        .setDescription(
                            "❌ Lavalink tidak support Spotify link.\n" +
                                "Coba search dengan judul lagu saja, contoh:\n" +
                                "`/play judul: shape of you ed sheeran`",
                        );
                    return interaction.editReply({ embeds: [embed] });
                }
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
                    name: isPlaying ? " Added to Queue" : " Now Playing",
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
                    },
                )
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Play error:", error?.message || error);
            console.error("Play error stack:", error?.stack);

            // Determine specific error message
            let errorMsg = "Terjadi error saat memutar lagu.";
            const errStr = (error?.message || "").toLowerCase();

            if (
                errStr.includes("no available node") ||
                errStr.includes("no node") ||
                errStr.includes("connection") ||
                errStr.includes("connect")
            ) {
                errorMsg =
                    "Tidak ada server musik yang tersedia saat ini. Coba lagi dalam beberapa detik.";
            } else if (
                errStr.includes("load failed") ||
                errStr.includes("no matches") ||
                errStr.includes("not found")
            ) {
                errorMsg =
                    "Gagal memuat lagu. Coba gunakan judul yang lebih spesifik atau link langsung.";
            } else if (
                errStr.includes("timed out") ||
                errStr.includes("timeout")
            ) {
                errorMsg = "Koneksi ke server musik timeout. Coba lagi nanti.";
            } else if (
                errStr.includes("bad request") ||
                errStr.includes("response code: 400")
            ) {
                errorMsg =
                    "Server musik menolak request (Bad Request). Coba lagi dalam beberapa detik.";
            } else if (
                errStr.includes("4xx") ||
                errStr.includes("forbidden") ||
                errStr.includes("blocked")
            ) {
                errorMsg =
                    "Lagu ini tidak bisa diputar (mungkin di-block oleh sumbernya).";
            }

            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `${errorMsg}\n\`\`\`${error?.message || "Unknown error"}\`\`\``,
                );
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
