const { Kazagumo } = require("kazagumo");
const { Connectors } = require("shoukaku");
const { EmbedBuilder } = require("discord.js");

// Load Lavalink nodes from environment variables
const nodes = [];

// Main node
if (process.env.LAVALINK_MAIN_URL) {
    nodes.push({
        name: process.env.LAVALINK_MAIN_NAME || "Lavalink-Main",
        url: process.env.LAVALINK_MAIN_URL,
        auth: process.env.LAVALINK_MAIN_AUTH || "youshallnotpass",
        secure: process.env.LAVALINK_MAIN_SECURE === "true",
    });
}

// Fallback node
if (process.env.LAVALINK_FALLBACK_URL) {
    nodes.push({
        name: process.env.LAVALINK_FALLBACK_NAME || "Lavalink-Fallback",
        url: process.env.LAVALINK_FALLBACK_URL,
        auth: process.env.LAVALINK_FALLBACK_AUTH || "youshallnotpass",
        secure: process.env.LAVALINK_FALLBACK_SECURE === "true",
    });
}

// Fallback to default nodes if no env vars set
if (nodes.length === 0) {
    console.warn(
        "⚠️ No Lavalink nodes configured in .env, using default nodes",
    );
    nodes.push(
        {
            name: "Serenetia",
            url: "lavalinkv4.serenetia.com:443",
            auth: "https://seretia.link/discord",
            secure: true,
        },
        {
            name: "Jirayu",
            url: "lavalink.jirayu.net:443",
            auth: "youshallnotpass",
            secure: true,
        },
    );
}

console.log(`🎵 Loaded ${nodes.length} Lavalink node(s) from configuration`);

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

// Patch Shoukaku node REST to handle rate limits (429) with exponential backoff
function patchNodeRest(node, nodeName) {
    if (!node || !node.rest || node.rest._rateLimitPatched) return;

    const originalFetch = node.rest.fetch.bind(node.rest);
    const MAX_RETRIES = 3;

    node.rest.fetch = async function (...args) {
        let lastError;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await originalFetch(...args);
            } catch (error) {
                lastError = error;
                if (error.status === 429) {
                    const delay =
                        Math.pow(2, attempt) * 1000 +
                        Math.random() * 500;
                    console.warn(
                        `⚠️ [${nodeName}] Rate limited (429) on ${error.path || "unknown"}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
                    );
                    await new Promise((r) => setTimeout(r, delay));
                    continue;
                }
                // Not a 429 — rethrow immediately
                throw error;
            }
        }
        // All retries exhausted — log and suppress to prevent crash
        console.error(
            `❌ [${nodeName}] Rate limit retries exhausted after ${MAX_RETRIES} attempts on ${lastError?.path || "unknown"}. Suppressing to prevent crash.`,
        );
        return null;
    };

    node.rest._rateLimitPatched = true;
    console.log(`🛡️ Rate-limit handler patched for node "${nodeName}"`);
}

// Track which nodes support Spotify (LavaSrc plugin)
const spotifyNodes = new Set();

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
            resume: false,
            reconnectTries: 10,
            restTimeout: 30,
            voiceConnectionTimeout: 15,
            nodeResolver: (nodes) => {
                // Pick connected nodes, prefer Spotify-capable ones
                const connected = [...nodes.values()].filter((node) => node.state === 1);
                if (connected.length === 0) return null;

                // Prefer Spotify-capable nodes so Spotify searches don't route to incompatible nodes
                const spotifyCapable = connected.filter((n) => spotifyNodes.has(n.name));
                const candidates = spotifyCapable.length > 0 ? spotifyCapable : connected;
                return candidates.sort((a, b) => a.penalties - b.penalties)[0];
            },
        },
    );

    // Cooldown tracker for "Started playing" embeds (prevents spam during cascade skips)
    const playerStartCooldowns = new Map(); // guildId -> { trackUri, timestamp }

    // Player end - detect cascade failures and handle gracefully
    kazagumo.on("playerEnd", (player, endedTrack, reason) => {
        const trackTitle = endedTrack?.title || "Unknown";
        const endReason = reason || "finished";
        console.log(
            `⏹️ Track ended: ${trackTitle}, Reason: ${endReason}, Queue: ${player.queue.length}`,
        );

        // Detect rapid cascade failures (loadFailed, error, etc.)
        // If a track "ends" almost immediately (<3 seconds), it likely failed due to rate limiting
        const guildId = player.guildId;
        const lastStart = playerStartCooldowns.get(guildId);

        if (
            lastStart &&
            Date.now() - lastStart.timestamp < 3000 &&
            (endReason === "loadFailed" ||
                endReason === "cleanup" ||
                endReason === "error")
        ) {
            console.warn(
                `⚠️ Track "${trackTitle}" failed almost immediately (${endReason}). ` +
                    `Pausing auto-play for 3s to avoid cascade.`,
            );

            // Re-queue the failed track at the front so it can retry later
            if (endedTrack) {
                player.queue.unshift(endedTrack);
            }

            // Pause auto-play briefly to let rate limit cool down
            // We do this by temporarily stopping, then restarting after delay
            setTimeout(async () => {
                try {
                    if (
                        player.queue.length > 0 &&
                        !player.playing &&
                        !player.paused
                    ) {
                        console.log(
                            `🔄 Resuming playback after cascade cooldown for guild ${guildId}`,
                        );
                        await player.play();
                    }
                } catch (e) {
                    console.error(
                        "Failed to resume after cascade cooldown:",
                        e.message,
                    );
                }
            }, 3000);

            // Return early to prevent Kazagumo from auto-playing the next track immediately
            return;
        }
    });

    // Node events
    kazagumo.shoukaku.on("ready", async (name, reconnected) => {
        console.log(
            `✅ Lavalink node "${name}" ${reconnected ? "reconnected" : "connected"}`,
        );

        // Patch REST rate-limit handler for this node
        const node = kazagumo.shoukaku.nodes.get(name);
        patchNodeRest(node, name);

        // Check if node supports Spotify (LavaSrc plugin)
        if (!reconnected) {
            try {
                const testResult = await kazagumo.search(
                    "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
                    { engine: "spotify" },
                );
                if (testResult.tracks.length > 0) {
                    spotifyNodes.add(name);
                    console.log(
                        `🟢 Node "${name}" supports Spotify (LavaSrc)`,
                    );
                } else {
                    spotifyNodes.delete(name);
                    console.log(
                        `⚠️ Node "${name}" does NOT support Spotify directly`,
                    );
                }
            } catch (e) {
                spotifyNodes.delete(name);
                console.log(
                    `⚠️ Node "${name}" does NOT support Spotify directly - using YouTube fallback`,
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
            }`,
        );
        spotifyNodes.delete(name);
    });

    kazagumo.shoukaku.on("disconnect", (name, players, moved) => {
        console.log(
            `🔌 Lavalink node "${name}" disconnected. Players: ${players.length}, Moved: ${moved}`,
        );
        spotifyNodes.delete(name);
    });

    // Player start - Now Playing with cooldown to prevent spam
    kazagumo.on("playerStart", (player, track) => {
        console.log(`Bermain: ${track?.title || "Unknown"}`);

        const textChannel = player.data.get("textChannel");
        if (!textChannel || !track) return;

        // Debounce: minimum 5 second gap between "Started playing" embeds per guild
        // This prevents spam when tracks rapidly fail/skip due to rate limiting
        const guildId = player.guildId;
        const now = Date.now();
        const lastInfo = playerStartCooldowns.get(guildId);

        if (lastInfo) {
            const timeSince = now - lastInfo.timestamp;
            // Skip embed if same track or less than 5 seconds since last embed
            if (lastInfo.trackUri === (track.uri || track.title) || timeSince < 5000) {
                console.log(
                    `⏳ Skipping "Started playing" embed for "${track.title}" (cooldown: ${Math.round((5000 - timeSince) / 1000)}s remaining)`,
                );
                playerStartCooldowns.set(guildId, {
                    trackUri: track.uri || track.title,
                    timestamp: now,
                });
                return;
            }
        }

        playerStartCooldowns.set(guildId, {
            trackUri: track.uri || track.title,
            timestamp: now,
        });

        const title = truncate(track.title, 45);
        const artist = truncate(track.author, 25);
        const duration = formatDuration(track.length);
        const requester = track.requester;

        // Source icons (official)
        const spotifyIcon =
            "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png";
        const youtubeIcon =
            "https://www.youtube.com/s/desktop/f506bd45/img/favicon_32.png";
        const deezerIcon =
            "https://cdn-icons-png.flaticon.com/512/5968/5968837.png";

        // Check source from track (set in play.js) or fallback to URI detection
        const trackSource = track.source || "";
        const uri = track.uri || "";

        let sourceIcon = youtubeIcon;
        let sourceColor = "#FF0000";

        if (trackSource === "spotify" || uri.includes("spotify.com")) {
            sourceIcon = spotifyIcon;
            sourceColor = "#1DB954";
        } else if (trackSource === "deezer" || uri.includes("deezer.com")) {
            sourceIcon = deezerIcon;
            sourceColor = "#A238FF";
        }

        const embed = new EmbedBuilder()
            .setColor(sourceColor)
            .setAuthor({
                name: "Started playing",
                iconURL: sourceIcon,
            })
            .setDescription(
                `**[${title}](${uri || "#"})**\nby ${artist} • \`${duration}\``,
            )
            .setFooter({
                text: `Requested by ${requester?.username || "Unknown"}`,
                iconURL: requester?.displayAvatarURL?.() || undefined,
            });

        safeSend(textChannel, embed);
    });

    // Player empty - Auto disconnect (unless stay mode)
    kazagumo.on("playerEmpty", (player) => {
        const guildId = player.guildId;

        // Check if stay mode is enabled
        const stayMode = player.data.get("stayMode");
        if (stayMode) {
            console.log(
                `🔒 Stay mode enabled for guild ${guildId} - not disconnecting`,
            );
            return;
        }

        const timeoutId = setTimeout(() => {
            // Check if player still exists in kazagumo
            const existingPlayer = kazagumo.players.get(guildId);
            if (!existingPlayer) return; // Player already destroyed

            // Check stay mode again
            if (existingPlayer.data.get("stayMode")) return;

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
        const isRateLimit = error?.status === 429 || error?.message?.includes("429");

        if (isRateLimit) {
            console.warn(
                `⚠️ Player rate limited for guild ${player.guildId} — will retry automatically`,
            );
            // Don't send error message for rate limits, they're retried silently
            return;
        }

        console.error("Player error:", error);

        const textChannel = player.data.get("textChannel");
        if (textChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    "An error occurred while playing. Skipping to next track...",
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
