const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");
const { getSpotifyRecommendations } = require("../utils/spotify");

// Spotify genre seeds mapping
const genreMap = {
    pop: "pop",
    hiphop: "hip-hop",
    rock: "rock",
    edm: "edm",
    lofi: "chill",
    jazz: "jazz",
    kpop: "k-pop",
    jpop: "j-pop",
    indo: "indonesian",
    chill: "chill",
    workout: "work-out",
    sad: "sad",
    rnb: "r-n-b",
    metal: "metal",
    acoustic: "acoustic",
    classical: "classical",
    country: "country",
    reggae: "reggae",
    latin: "latin",
    anime: "anime",
};

const genreChoices = Object.keys(genreMap).map((g) => ({
    name: g.charAt(0).toUpperCase() + g.slice(1),
    value: g,
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName("random")
        .setDescription("Play random music dari Spotify recommendations")
        .addStringOption((option) =>
            option
                .setName("genre")
                .setDescription("Pilih genre")
                .setRequired(true)
                .addChoices(...genreChoices)
        )
        .addIntegerOption((option) =>
            option
                .setName("count")
                .setDescription("Jumlah lagu (1-20)")
                .setMinValue(1)
                .setMaxValue(20)
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
        const count = interaction.options.getInteger("count") || 10;
        const spotifyGenre = genreMap[genre];

        try {
            // Get recommendations from Spotify
            const recommendations = await getSpotifyRecommendations(
                spotifyGenre,
                count
            );

            if (!recommendations || recommendations.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription(
                        "Tidak bisa mendapatkan rekomendasi. Coba genre lain."
                    );
                return interaction.editReply({ embeds: [embed] });
            }

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

            const addedTracks = [];

            // Search and add tracks to queue
            for (const rec of recommendations) {
                const result = await kazagumo.search(rec.query, {
                    requester: interaction.user,
                });

                if (result.tracks.length > 0) {
                    const track = result.tracks[0];
                    track.source = "spotify";
                    player.queue.add(track);
                    addedTracks.push({
                        title: rec.title,
                        artist: rec.artist,
                        duration: rec.duration,
                    });
                }
            }

            if (addedTracks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Tidak bisa menemukan lagu.");
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
                .map(
                    (t, i) =>
                        `\`${i + 1}.\` ${t.title} • ${t.artist} \`${
                            t.duration
                        }\``
                )
                .join("\n");

            const remaining = addedTracks.length - 10;
            const moreText =
                remaining > 0 ? `\n\n\`+${remaining} more tracks\`` : "";

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setAuthor({
                    name: "🎲 Spotify Recommendations",
                    iconURL:
                        "https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png",
                })
                .setTitle(
                    `${genre.charAt(0).toUpperCase() + genre.slice(1)} Mix`
                )
                .setDescription(`${trackList}${moreText}`)
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
