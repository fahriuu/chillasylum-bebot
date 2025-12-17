const { Kazagumo } = require("kazagumo");
const { Connectors } = require("shoukaku");
const { EmbedBuilder } = require("discord.js");

// Lavalink node - single reliable node
const nodes = [
    {
        name: "Lavalink-Main",
        url: "lavalink.jirayu.net:13592",
        auth: "youshallnotpass",
        secure: false,
    },
];

let kazagumo = null;

// Helper: truncate text safely
function truncate(str, max) {
    if (!str || typeof str !== "string") return "Unknown";
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

// Helper: format duration (supports hours)
function formatDuration(ms) {
    if (!ms || isNaN(ms)) return "0:00";
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

// Safe send embed to channel
async function safeSend(channel, embed) {
    try {
        if (channel && typeof channel.send === "function") {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error("Failed to send embed:", error.message);
    }
}

function initLavalink(client) {
    kazagumo = new Kazagumo(
        {
            defaultSearchEngine: "youtube",
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            },
        },
        new Connectors.DiscordJS(client),
        nodes,
        {
            moveOnDisconnect: false,
            resumable: false,
            resumableTimeout: 30,
            reconnectTries: 5,
            restTimeout: 60000,
        }
    );

    // Override playerEnd to ensure auto-play works
    kazagumo.on("playerEnd", async (player, track, reason) => {
        const trackTitle = track?.title || "Unknown";
        const endReason = reason || "finished";
        console.log(
            `⏹️ Track ended: ${trackTitle}, Reason: ${endReason}, Queue: ${player.queue.length}`
        );

        // Skip if replaced (manual skip) or stopped
        if (endReason === "replaced" || endReason === "stopped") return;

        // Check if player still exists
        const guildId = player.guildId;
        const existingPlayer = kazagumo.players.get(guildId);
        if (!existingPlayer) return;

        // Auto play next track if queue has songs
        if (existingPlayer.queue.length > 0) {
            console.log(`📋 Playing next track...`);
            try {
                await existingPlayer.play();
            } catch (e) {
                console.error("Auto-play error:", e.message);
                // Try to skip to next if play fails
                if (existingPlayer.queue.length > 0) {
                    existingPlayer.queue.shift();
                    if (existingPlayer.queue.length > 0) {
                        try {
                            await existingPlayer.play();
                        } catch (e2) {
                            console.error("Retry play error:", e2.message);
                        }
                    }
                }
            }
            return;
        }

        // Queue empty
        const textChannel = existingPlayer.data.get("textChannel");
        if (textChannel) {
            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setDescription(
                    "Queue finished. Use `/play` to add more songs."
                );
            safeSend(textChannel, embed);
        }
    });

    // Node events
    kazagumo.shoukaku.on("ready", async (name, reconnected) => {
        console.log(`✅ Lavalink node "${name}" connected`);

        // Check if node supports Spotify (LavaSrc plugin)
        if (!reconnected) {
            try {
                const testResult = await kazagumo.search(
                    "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
                    { engine: "spotify" }
                );
                if (testResult.tracks.length > 0) {
                    console.log(`✅ Node "${name}" supports Spotify (LavaSrc)`);
                } else {
                    console.log(
                        `⚠️ Node "${name}" does NOT support Spotify directly`
                    );
                }
            } catch (e) {
                console.log(
                    `⚠️ Node "${name}" does NOT support Spotify directly - using YouTube fallback`
                );
            }
        }
    });

    kazagumo.shoukaku.on("error", (name, error) => {
        console.error(`❌ Lavalink node "${name}" error:`, error.message);
    });

    kazagumo.shoukaku.on("close", (name, code, reason) => {
        console.log(
            `⚠️ Lavalink node "${name}" closed: ${code} - ${
                reason || "No reason"
            }`
        );
    });

    kazagumo.shoukaku.on("disconnect", (name, players, moved) => {
        console.log(
            `🔌 Lavalink node "${name}" disconnected. Players: ${players.length}, Moved: ${moved}`
        );
    });

    // Player start - Now Playing log
    kazagumo.on("playerStart", (player, track) => {
        console.log(`▶️ Playing: ${track?.title || "Unknown"}`);

        const textChannel = player.data.get("textChannel");
        if (!textChannel || !track) return;

        const title = truncate(track.title, 45);
        const artist = truncate(track.author, 25);
        const duration = formatDuration(track.length);
        const requester = track.requester;

        // Source icons
        const spotifyIcon =
            "https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green.png";
        const youtubeIcon =
            "https://cdn.pixabay.com/photo/2021/05/22/11/38/yt-6273367_1280.png";

        // Check source from track (set in play.js) or fallback to URI detection
        const trackSource = track.source || "";
        const uri = track.uri || "";

        let sourceIcon = youtubeIcon;
        let sourceColor = "#FF0000";

        if (trackSource === "spotify" || uri.includes("spotify.com")) {
            sourceIcon = spotifyIcon;
            sourceColor = "#1DB954";
        }

        const embed = new EmbedBuilder()
            .setColor(sourceColor)
            .setAuthor({
                name: "Started playing",
                iconURL: sourceIcon,
            })
            .setDescription(
                `**[${title}](${uri || "#"})**\nby ${artist} • \`${duration}\``
            )
            .setFooter({
                text: `Requested by ${requester?.username || "Unknown"}`,
                iconURL: requester?.displayAvatarURL?.() || undefined,
            });

        safeSend(textChannel, embed);
    });

    // Player empty - Auto disconnect
    kazagumo.on("playerEmpty", (player) => {
        const guildId = player.guildId;

        const timeoutId = setTimeout(() => {
            // Check if player still exists in kazagumo
            const existingPlayer = kazagumo.players.get(guildId);
            if (!existingPlayer) return; // Player already destroyed

            // Double check player is empty
            if (
                !existingPlayer.queue.length &&
                !existingPlayer.playing &&
                !existingPlayer.paused
            ) {
                const textChannel = existingPlayer.data.get("textChannel");
                if (textChannel) {
                    const embed = new EmbedBuilder()
                        .setColor("#2b2d31")
                        .setDescription("Disconnected due to inactivity.");
                    safeSend(textChannel, embed);
                }

                try {
                    existingPlayer.destroy();
                } catch (e) {
                    // Ignore if already destroyed
                }
            }
        }, 180000); // 3 menit

        // Store timeout to clear if new song added
        player.data.set("disconnectTimeout", timeoutId);
    });

    // Player resolve - Track loaded
    kazagumo.on("playerResolve", (player, track) => {
        // Clear disconnect timeout when new track is added
        const timeoutId = player.data.get("disconnectTimeout");
        if (timeoutId) {
            clearTimeout(timeoutId);
            player.data.delete("disconnectTimeout");
        }
    });

    // Player error
    kazagumo.on("playerError", (player, error) => {
        console.error("Player error:", error);

        const textChannel = player.data.get("textChannel");
        if (textChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    "An error occurred while playing. Skipping to next track..."
                );
            safeSend(textChannel, embed);
        }
    });

    return kazagumo;
}

function getKazagumo() {
    return kazagumo;
}

module.exports = { initLavalink, getKazagumo };
