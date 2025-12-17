const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

// Curated playlists by genre/mood
const playlists = {
    pop: [
        "pop hits 2024",
        "top 50 global",
        "viral hits",
        "dance pop mix",
        "feel good pop",
    ],
    hiphop: [
        "hip hop hits",
        "rap caviar",
        "hip hop mix 2024",
        "trap nation",
        "rap hits",
    ],
    rock: [
        "rock classics",
        "alternative rock",
        "indie rock mix",
        "rock anthems",
        "modern rock",
    ],
    edm: [
        "edm hits",
        "electronic dance",
        "house music mix",
        "bass boosted",
        "festival bangers",
    ],
    lofi: [
        "lofi hip hop",
        "lofi beats to study",
        "chill lofi",
        "lofi sleep",
        "lofi cafe",
    ],
    jazz: [
        "jazz classics",
        "smooth jazz",
        "jazz cafe",
        "jazz vibes",
        "modern jazz",
    ],
    kpop: [
        "kpop hits 2024",
        "kpop dance",
        "kpop ballad",
        "kpop mix",
        "top kpop songs",
    ],
    jpop: [
        "jpop hits",
        "anime openings",
        "japanese pop",
        "j-rock mix",
        "anime songs",
    ],
    indo: [
        "lagu indonesia terbaru",
        "pop indonesia",
        "hits indonesia 2024",
        "dangdut remix",
        "indonesian viral",
    ],
    chill: [
        "chill vibes",
        "relaxing music",
        "acoustic chill",
        "sunday morning",
        "peaceful piano",
    ],
    workout: [
        "workout motivation",
        "gym music",
        "running playlist",
        "beast mode",
        "power workout",
    ],
    sad: [
        "sad songs",
        "broken heart",
        "sad playlist",
        "emotional songs",
        "crying playlist",
    ],
};

const genreChoices = Object.keys(playlists).map((g) => ({
    name: g.charAt(0).toUpperCase() + g.slice(1),
    value: g,
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName("random")
        .setDescription("Play random music based on genre/mood")
        .addStringOption((option) =>
            option
                .setName("genre")
                .setDescription("Pick a genre or mood")
                .setRequired(true)
                .addChoices(...genreChoices)
        )
        .addIntegerOption((option) =>
            option
                .setName("count")
                .setDescription("How many songs (1-10)")
                .setMinValue(1)
                .setMaxValue(10)
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
                .setDescription("Music system belum siap.");
            return interaction.editReply({ embeds: [embed] });
        }

        // Check if bot is in different voice channel
        let player = kazagumo.players.get(interaction.guild.id);
        if (player && player.voiceId !== voiceChannel.id) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Bot sedang digunakan di <#${player.voiceId}>.`
                );
            return interaction.editReply({ embeds: [embed] });
        }

        const genre = interaction.options.getString("genre");
        const count = interaction.options.getInteger("count") || 5;

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

            // Pick random search queries from genre
            const queries = playlists[genre];
            const shuffled = queries.sort(() => Math.random() - 0.5);
            const selectedQueries = shuffled.slice(0, Math.ceil(count / 2));

            const addedTracks = [];

            for (const query of selectedQueries) {
                const result = await kazagumo.search(query, {
                    requester: interaction.user,
                });

                if (result.tracks.length > 0) {
                    // Pick random tracks from results
                    const shuffledTracks = result.tracks
                        .slice(0, 10)
                        .sort(() => Math.random() - 0.5);
                    const tracksToAdd = shuffledTracks.slice(
                        0,
                        Math.ceil(count / selectedQueries.length)
                    );

                    for (const track of tracksToAdd) {
                        if (addedTracks.length >= count) break;
                        track.source = "youtube"; // Random search uses YouTube
                        player.queue.add(track);
                        addedTracks.push(track);
                    }
                }
                if (addedTracks.length >= count) break;
            }

            if (addedTracks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Tidak bisa menemukan lagu random.");
                return interaction.editReply({ embeds: [embed] });
            }

            if (!player.playing && !player.paused) {
                try {
                    await player.play();
                } catch (e) {
                    console.error("Play error:", e.message);
                }
            }

            const trackList = addedTracks
                .slice(0, 10)
                .map((t, i) => `\`${i + 1}.\` ${t.title}`)
                .join("\n");

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setAuthor({ name: "🎲 Random Music" })
                .setTitle(
                    `${genre.charAt(0).toUpperCase() + genre.slice(1)} Mix`
                )
                .setDescription(trackList)
                .setFooter({
                    text: `${addedTracks.length} tracks • Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Random play error:", error);
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Terjadi error.");
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
