const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");
const { isDeezerUrl, parseDeezerUrl, getDeezerTrack, getDeezerAlbum, getDeezerPlaylist, getPlaylistInfo } = require("../utils/deezer");

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

// Helper: send paginated playlist embed with scroll buttons
async function sendPaginatedPlaylist(interaction, tracks, options) {
    const { color, iconURL, playlistName, url } = options;
    const perPage = 10;
    const totalDuration = tracks.reduce((acc, t) => acc + (t.length || 0), 0);
    const totalDurStr = formatDuration(totalDuration);
    const totalPages = Math.ceil(tracks.length / perPage);
    let page = 0;
    const uid = Date.now().toString(36);

    function buildEmbed(p) {
        const start = p * perPage;
        const list = tracks.slice(start, start + perPage)
            .map((t, i) => {
                const n = start + i + 1;
                const title = truncate(t.title, 35);
                const artist = truncate(t.author, 20);
                const dur = formatDuration(t.length);
                return `\`${String(n).padStart(2, " ")}.\` **${title}**\n\u3000   ${artist} \u2022 \`${dur}\``;
            }).join("\n");

        return new EmbedBuilder()
            .setColor(color)
            .setAuthor({ name: "\u2705 Added to Queue", iconURL })
            .setTitle(playlistName)
            .setURL(url)
            .setDescription(`\ud83c\udfb5 **${tracks.length}** tracks \u2022 \u23f1\ufe0f **${totalDurStr}**\n\n${list}`)
            .setThumbnail(tracks[0]?.thumbnail || null)
            .setFooter({
                text: `Page ${p + 1}/${totalPages} \u2022 Requested by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();
    }

    function buildButtons(p) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`pl_first_${uid}`).setEmoji("\u23ee\ufe0f").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
            new ButtonBuilder().setCustomId(`pl_prev_${uid}`).setEmoji("\u25c0\ufe0f").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
            new ButtonBuilder().setCustomId(`pl_info_${uid}`).setLabel(`${p + 1} / ${totalPages}`).setStyle(ButtonStyle.Primary).setDisabled(true),
            new ButtonBuilder().setCustomId(`pl_next_${uid}`).setEmoji("\u25b6\ufe0f").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
            new ButtonBuilder().setCustomId(`pl_last_${uid}`).setEmoji("\u23ed\ufe0f").setStyle(ButtonStyle.Secondary).setDisabled(p >= totalPages - 1),
        );
    }

    const components = totalPages > 1 ? [buildButtons(page)] : [];
    const reply = await interaction.editReply({ embeds: [buildEmbed(page)], components });

    if (totalPages > 1) {
        const collector = reply.createMessageComponentCollector({
            filter: (btn) => btn.customId.endsWith(uid),
            time: 120_000,
        });

        collector.on("collect", async (btn) => {
            if (btn.user.id !== interaction.user.id) {
                return btn.reply({ content: "\u274c Hanya yang request yang bisa scroll!", ephemeral: true });
            }
            if (btn.customId.startsWith("pl_first")) page = 0;
            else if (btn.customId.startsWith("pl_prev")) page = Math.max(0, page - 1);
            else if (btn.customId.startsWith("pl_next")) page = Math.min(totalPages - 1, page + 1);
            else if (btn.customId.startsWith("pl_last")) page = totalPages - 1;
            await btn.update({ embeds: [buildEmbed(page)], components: [buildButtons(page)] });
        });

        collector.on("end", async () => {
            try { await interaction.editReply({ components: [] }); } catch (e) { /* ignored */ }
        });
    }
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
                    let result = await kazagumo.search(query, {
                        requester: interaction.user,
                        engine: "spotify",
                    });

                    // If Spotify engine returned nothing, retry without engine restriction (auto-fallback)
                    if (
                        !result ||
                        !result.tracks ||
                        result.tracks.length === 0
                    ) {
                        console.log("Spotify search returned 0 results, retrying without engine restriction...");
                        result = await kazagumo.search(query, {
                            requester: interaction.user,
                        });
                    }

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
                        result.tracks.forEach((track) => {
                            track.source = "spotify";
                            player.queue.add(track);
                        });

                        if (!player.playing && !player.paused) {
                            await player.play();
                        }

                        return sendPaginatedPlaylist(interaction, result.tracks, {
                            color: "#1DB954",
                            iconURL: "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
                            playlistName: result.playlistName || "Spotify Playlist",
                            url: query,
                        });
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
                                    value: `\`#${player.queue.length + 1}\``,
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

            // Handle Deezer URL
            if (isDeezerUrl(query)) {
                const loadingEmbed = new EmbedBuilder()
                    .setColor("#A238FF")
                    .setDescription(" Tunggu sedang mencari lagu dari Deezer...");
                await interaction.editReply({ embeds: [loadingEmbed] });

                try {
                    // Try LavaSrc first
                    const result = await kazagumo.search(query, {
                        requester: interaction.user,
                        engine: "deezer",
                    });

                    if (!result || !result.tracks || result.tracks.length === 0) {
                        throw new Error("Lavalink tidak support Deezer secara langsung.");
                    }

                    const isPlaylist = result.tracks.length > 1;

                    if (isPlaylist) {
                        result.tracks.forEach((track) => {
                            track.source = "deezer";
                            player.queue.add(track);
                        });

                        if (!player.playing && !player.paused) {
                            await player.play();
                        }

                        return sendPaginatedPlaylist(interaction, result.tracks, {
                            color: "#A238FF",
                            iconURL: "https://cdn-icons-png.flaticon.com/512/5968/5968837.png",
                            playlistName: result.playlistName || "Deezer Playlist",
                            url: query,
                        });
                    } else {
                        const track = result.tracks[0];
                        track.source = "deezer";
                        player.queue.add(track);

                        const isPlaying = player.playing || player.paused;
                        if (!isPlaying) {
                            await player.play();
                        }

                        const embed = new EmbedBuilder()
                            .setColor("#A238FF")
                            .setAuthor({
                                name: isPlaying ? "Added to Queue" : "Now Playing",
                                iconURL: "https://cdn-icons-png.flaticon.com/512/5968/5968837.png",
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
                                    value: `\`#${player.queue.length + 1}\``,
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
                } catch (deezerError) {
                    // Fallback to Deezer API + YouTube search
                    console.log("Lavalink Deezer failed, falling back to Deezer API:", deezerError.message);
                    
                    const parsed = parseDeezerUrl(query);
                    if (!parsed) {
                        const embed = new EmbedBuilder().setColor("#ed4245").setDescription("❌ Link Deezer tidak dapat dibaca.");
                        return interaction.editReply({ embeds: [embed] });
                    }

                    if (parsed.type === "track") {
                        const meta = await getDeezerTrack(parsed.id);
                        if (!meta) {
                            const embed = new EmbedBuilder().setColor("#ed4245").setDescription("❌ Gagal mengambil data lagu dari API Deezer.");
                            return interaction.editReply({ embeds: [embed] });
                        }

                        const searchResult = await kazagumo.search(meta.query, { requester: interaction.user });
                        if (!searchResult || !searchResult.tracks.length) {
                            const embed = new EmbedBuilder().setColor("#ed4245").setDescription("❌ Gagal menemukan audio untuk lagu tersebut di YouTube.");
                            return interaction.editReply({ embeds: [embed] });
                        }

                        const track = searchResult.tracks[0];
                        track.title = meta.title;
                        track.author = meta.artist;
                        track.thumbnail = meta.thumbnail;
                        track.source = "deezer";
                        track.uri = meta.uri;

                        player.queue.add(track);

                        const isPlaying = player.playing || player.paused;
                        if (!isPlaying) await player.play();

                        const embed = new EmbedBuilder()
                            .setColor("#A238FF")
                            .setAuthor({
                                name: isPlaying ? "Added to Queue" : "Now Playing",
                                iconURL: "https://cdn-icons-png.flaticon.com/512/5968/5968837.png"
                            })
                            .setTitle(truncate(track.title, 50))
                            .setURL(track.uri)
                            .setThumbnail(track.thumbnail || null)
                            .setDescription(`by **${track.author || "Unknown"}**`)
                            .addFields(
                                { name: "Duration", value: `\`${meta.duration}\``, inline: true },
                                { name: "Position", value: `\`#${player.queue.length + 1}\``, inline: true }
                            )
                            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    } else {
                        const tracks = parsed.type === "playlist" ? await getDeezerPlaylist(parsed.id) : await getDeezerAlbum(parsed.id);
                        const listInfo = await getPlaylistInfo(parsed.id, parsed.type);

                        if (!tracks || tracks.length === 0) {
                            const embed = new EmbedBuilder().setColor("#ed4245").setDescription("❌ Gagal mengambil data playlist/album dari API Deezer.");
                            return interaction.editReply({ embeds: [embed] });
                        }

                        const limit = Math.min(tracks.length, 10);
                        const resolvedTracks = [];
                        
                        const msgEmbed = new EmbedBuilder().setColor("#A238FF").setDescription(`🔍 Sedang mencocokkan ${limit} lagu dari Deezer ke YouTube...`);
                        await interaction.editReply({ embeds: [msgEmbed] });

                        for (let i = 0; i < limit; i++) {
                            const meta = tracks[i];
                            const res = await kazagumo.search(meta.query, { requester: interaction.user });
                            if (res && res.tracks.length) {
                                const trk = res.tracks[0];
                                trk.title = meta.title;
                                trk.author = meta.artist;
                                trk.thumbnail = meta.thumbnail;
                                trk.uri = meta.uri;
                                trk.source = "deezer";
                                resolvedTracks.push(trk);
                                player.queue.add(trk);
                            }
                        }

                        if (!player.playing && !player.paused && resolvedTracks.length > 0) {
                            await player.play();
                        }

                        const startPosition = player.queue.length - resolvedTracks.length;
                        const trackList = resolvedTracks.map((t, i) => {
                            const title = truncate(t.title, 30);
                            const artist = truncate(t.author, 20);
                            const queuePos = startPosition + i + 1;
                            const duration = formatDuration(t.length);
                            return `\`${String(queuePos).padStart(2, " ")}.\` ${title} • ${artist} \`${duration}\``;
                        }).join("\n");

                        const remaining = tracks.length - resolvedTracks.length;
                        const moreText = remaining > 0 ? `\n\n\`+${remaining} lagu lainnya tidak dimuat untuk mencegah lag.\`` : "";

                        const embed = new EmbedBuilder()
                            .setColor("#A238FF")
                            .setAuthor({
                                name: "✅ Added to Queue",
                                iconURL: "https://cdn-icons-png.flaticon.com/512/5968/5968837.png"
                            })
                            .setTitle(listInfo ? listInfo.name : "Deezer Playlist")
                            .setURL(query)
                            .setDescription(`${trackList}${moreText}`)
                            .setThumbnail(listInfo ? listInfo.thumbnail : tracks[0].thumbnail)
                            .setFooter({ text: `${resolvedTracks.length} tracks loaded • Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                            .setTimestamp();

                        return interaction.editReply({ embeds: [embed] });
                    }
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
            } else if (query.includes("deezer.com") || query.includes("deezer.page.link")) {
                track.source = "deezer";
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
                        value: `\`#${player.queue.length + 1}\``,
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
                error?.status === 429 ||
                errStr.includes("429") ||
                errStr.includes("rate limit") ||
                errStr.includes("too many requests")
            ) {
                errorMsg =
                    "Server musik sedang rate limited (terlalu banyak request). Tunggu beberapa detik lalu coba lagi.";
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
