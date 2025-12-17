const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

// Random search queries per genre
const genreQueries = {
    pop: ["top hits 2024", "pop music mix", "billboard hits"],
    rock: ["rock music mix", "classic rock hits", "rock anthems"],
    hiphop: ["hip hop mix 2024", "rap hits", "hip hop playlist"],
    edm: ["edm mix", "electronic dance music", "edm hits"],
    jazz: ["jazz music", "smooth jazz", "jazz classics"],
    kpop: ["kpop hits", "kpop mix 2024", "korean pop"],
    metal: ["metal music mix", "heavy metal hits", "metal playlist"],
    acoustic: ["acoustic covers", "acoustic music", "acoustic hits"],
    classical: ["classical music", "piano classical", "orchestra music"],
    indie: ["indie music mix", "indie hits", "indie playlist"],
    rnb: ["rnb music mix", "r&b hits", "rnb playlist"],
    lofi: ["lofi hip hop", "lofi beats", "lofi music"],
};

const genreChoices = Object.keys(genreQueries).map((g) => ({
    name: g.charAt(0).toUpperCase() + g.slice(1),
    value: g,
}));

module.exports = {
    data: new SlashCommandBuilder()
        .setName("random")
        .setDescription("Play random music berdasarkan genre")
        .addStringOption((option) =>
            option
                .setName("genre")
                .setDescription("Pilih genre")
                .setRequired(true)
                .addChoices(...genreChoices)
        )
        .addIntegerOption((option) =>
            option
                .setName("jumlah")
                .setDescription("Jumlah lagu (1-10)")
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
        const jumlah = interaction.options.getInteger("jumlah") || 1;
        const queries = genreQueries[genre];
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];

        try {
            const result = await kazagumo.search(randomQuery, {
                requester: interaction.user,
            });

            if (!result.tracks.length) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Tidak bisa menemukan lagu.");
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

            // Pick random tracks from results
            const availableTracks = result.tracks.slice(0, 20);
            const shuffled = availableTracks.sort(() => Math.random() - 0.5);
            const selectedTracks = shuffled.slice(0, jumlah);

            for (const track of selectedTracks) {
                player.queue.add(track);
            }

            if (!player.playing && !player.paused) {
                await player.play();
            }

            let description;
            if (selectedTracks.length === 1) {
                const track = selectedTracks[0];
                description = `**[${track.title}](${track.uri})**\nby ${track.author}`;
            } else {
                description = selectedTracks
                    .map((t, i) => `\`${i + 1}.\` **${t.title}** • ${t.author}`)
                    .join("\n");
            }

            const embed = new EmbedBuilder()
                .setColor("#5865F2")
                .setAuthor({ name: "🎲 Random Music" })
                .setDescription(description)
                .setFooter({
                    text: `Genre: ${
                        genre.charAt(0).toUpperCase() + genre.slice(1)
                    } • ${selectedTracks.length} lagu • ${
                        interaction.user.username
                    }`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

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
