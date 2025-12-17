const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
} = require("@discordjs/voice");
const play = require("play-dl");
const { EmbedBuilder } = require("discord.js");
const { getQueue, deleteQueue } = require("./musicQueue");

// Set FFmpeg path
require("ffmpeg-static");

async function playSong(guildId, song) {
    const queue = getQueue(guildId);

    if (!song) {
        if (queue.connection) {
            queue.connection.destroy();
        }
        deleteQueue(guildId);
        return;
    }

    // Validasi URL sebelum stream
    if (
        !song.url ||
        typeof song.url !== "string" ||
        !song.url.includes("youtube.com")
    ) {
        console.error("Invalid song URL:", song.url);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(guildId, queue.songs[0]);
        }
        return;
    }

    console.log(`Playing: ${song.title} | URL: ${song.url}`);

    try {
        const streamInfo = await play.stream(song.url, { quality: 2 });

        const resource = createAudioResource(streamInfo.stream, {
            inputType: streamInfo.type,
        });

        queue.player.play(resource);
        queue.playing = true;

        const embed = new EmbedBuilder()
            .setColor("#1DB954")
            .setTitle("Now Playing")
            .setDescription(`**${song.title}**`)
            .setThumbnail(song.thumbnail)
            .addFields(
                {
                    name: "Artist",
                    value: song.artist || "Unknown",
                    inline: true,
                },
                {
                    name: "Duration",
                    value: song.duration || "0:00",
                    inline: true,
                },
                {
                    name: "Requested by",
                    value: `<@${song.requestedBy}>`,
                    inline: true,
                }
            )
            .setFooter({ text: `Queue: ${queue.songs.length} song(s)` });

        if (queue.textChannel) {
            queue.textChannel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error("Error playing song:", error.message);

        // Send error message to channel
        if (queue.textChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Failed to play **${song.title}**. Skipping...`
                );
            queue.textChannel.send({ embeds: [embed] });
        }

        queue.songs.shift();
        if (queue.songs.length > 0) {
            setTimeout(() => playSong(guildId, queue.songs[0]), 1000);
        } else {
            queue.playing = false;
        }
    }
}

async function connectToChannel(voiceChannel, textChannel, guildId) {
    const queue = getQueue(guildId);

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
        },
    });

    player.on(AudioPlayerStatus.Idle, () => {
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(guildId, queue.songs[0]);
        } else {
            queue.playing = false;
            setTimeout(() => {
                if (!queue.playing && queue.songs.length === 0) {
                    if (queue.connection) {
                        queue.connection.destroy();
                    }
                    deleteQueue(guildId);
                }
            }, 300000);
        }
    });

    player.on("error", (error) => {
        console.error("Player error:", error.message);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            setTimeout(() => playSong(guildId, queue.songs[0]), 1000);
        }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
            ]);
        } catch {
            deleteQueue(guildId);
        }
    });

    connection.subscribe(player);

    queue.connection = connection;
    queue.player = player;
    queue.textChannel = textChannel;
    queue.voiceChannel = voiceChannel;

    return queue;
}

module.exports = { playSong, connectToChannel };
