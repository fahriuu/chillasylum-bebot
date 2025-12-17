const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");
const {
    isUserConnected,
    getUserLikedSongs,
    getUserTopTracks,
} = require("../utils/spotifyAuth");

function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("liked")
        .setDescription("Play your Spotify liked songs or top tracks")
        .addStringOption((option) =>
            option
                .setName("type")
                .setDescription("What to play")
                .setRequired(true)
                .addChoices(
                    { name: "Liked Songs", value: "liked" },
                    { name: "Top Tracks", value: "top" }
                )
        )
        .addIntegerOption((option) =>
            option
                .setName("limit")
                .setDescription("Number of songs (max 50)")
                .setMinValue(1)
                .setMaxValue(50)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        // Check Spotify connection
        if (!isUserConnected(interaction.user.id)) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    "❌ Kamu belum connect Spotify!\n\nGunakan `/spotify connect` dulu."
                );
            return interaction.editReply({ embeds: [embed] });
        }

        // Check voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("❌ Kamu harus join voice channel dulu!");
            return interaction.editReply({ embeds: [embed] });
        }

        const kazagumo = getKazagumo();
        if (!kazagumo) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("❌ Music system belum siap.");
            return interaction.editReply({ embeds: [embed] });
        }

        const type = interaction.options.getString("type");
        const limit = interaction.options.getInteger("limit") || 25;

        try {
            // Get tracks from Spotify
            const tracks =
                type === "liked"
                    ? await getUserLikedSongs(interaction.user.id, limit)
                    : await getUserTopTracks(interaction.user.id, limit);

            if (!tracks || tracks.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription(
                        `❌ Tidak ada ${
                            type === "liked" ? "liked songs" : "top tracks"
                        } ditemukan.`
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            // Get or create player
            let player = kazagumo.players.get(interaction.guild.id);
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

            const startPosition = player.queue.length;

            // Add tracks to queue
            let addedCount = 0;
            for (const track of tracks) {
                const result = await kazagumo.search(track.query, {
                    requester: interaction.user,
                });
                if (result.tracks.length > 0) {
                    player.queue.add(result.tracks[0]);
                    addedCount++;
                }
            }

            if (!player.playing && !player.paused) {
                player.play();
            }

            // Build track list
            const trackList = tracks
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

            const remaining = tracks.length - 10;
            const moreText =
                remaining > 0 ? `\n\n\`+${remaining} more tracks\`` : "";

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setAuthor({ name: "🎵 Added to Queue" })
                .setTitle(type === "liked" ? "💚 Liked Songs" : "🔥 Top Tracks")
                .setDescription(`${trackList}${moreText}`)
                .setThumbnail(tracks[0]?.thumbnail)
                .setFooter({
                    text: `${addedCount} tracks • Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL(),
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error("Liked songs error:", error);
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    "❌ Terjadi error. Coba `/spotify connect` ulang."
                );
            return interaction.editReply({ embeds: [embed] });
        }
    },
};
