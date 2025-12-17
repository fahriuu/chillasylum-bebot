const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    StreamType,
} = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");
const { EmbedBuilder } = require("discord.js");
const { getQueue, deleteQueue } = require("./musicQueue");

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
        !song.url.startsWith("http")
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
        const stream = ytdl(song.url, {
            filter: "audioonly",
            quality: "highestaudio",
            highWaterMark: 1 << 25,
        });

        const resource = createAudioResource(stream, {
            inputType: StreamType.Arbitrary,
        });

        queue.player.play(resource);
        queue.playing = true;

        const embed = new EmbedBuilder()
            .setColor("#1DB954")
            .setTitle("Now Playing")
            .setDescription(`**${song.title}**`)
            .setThumbnail(song.thumbnail)
            .addFields(
                { name: "Artist", value: song.artist, inline: true },
                { name: "Duration", value: song.duration, inline: true },
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
        console.error("Error playing song:", error);
        queue.songs.shift();
        if (queue.songs.length > 0 && queue.songs[0]?.url) {
            playSong(guildId, queue.songs[0]);
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
        console.error("Player error:", error);
        queue.songs.shift();
        if (queue.songs.length > 0) {
            playSong(guildId, queue.songs[0]);
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
