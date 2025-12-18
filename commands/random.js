const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

// Random search queries per genre (latest 2025)
const genreQueries = {
    pop: [
        "new pop songs 2025",
        "latest pop hits 2025",
        "trending pop music 2025",
        "viral pop songs 2025",
    ],
    rock: ["new rock songs 2025", "latest rock music 2025", "rock hits 2025"],
    hiphop: [
        "new hip hop 2025",
        "latest rap songs 2025",
        "trending rap 2025",
        "viral hip hop 2025",
    ],
    edm: [
        "new edm 2025",
        "latest edm hits 2025",
        "trending electronic music 2025",
    ],
    jazz: ["new jazz 2025", "modern jazz music", "contemporary jazz 2025"],
    kpop: [
        "new kpop 2025",
        "latest kpop songs 2025",
        "trending kpop 2025",
        "viral kpop 2025",
    ],
    metal: [
        "new metal songs 2025",
        "latest metal music 2025",
        "metal hits 2025",
    ],
    acoustic: [
        "new acoustic covers 2025",
        "latest acoustic songs 2025",
        "trending acoustic 2025",
    ],
    classical: [
        "modern classical music",
        "contemporary classical",
        "new classical 2025",
    ],
    indie: [
        "new indie songs 2025",
        "latest indie music 2025",
        "trending indie 2025",
    ],
    rnb: ["new rnb 2025", "latest r&b songs 2025", "trending rnb 2025"],
    lofi: [
        "new lofi 2025",
        "latest lofi beats 2025",
        "trending lofi music",
        "lofi chill 2025",
    ],
    poppunk: [
        "pop punk indonesia terbaru 2025",
        "lagu pop punk indonesia terbaru",
        "band pop punk indonesia",
        "pee wee gaskins",
        "rocket rockers",
        "stand here alone",
        "last child",
    ],
    indo: [
        "lagu indonesia terbaru 2025",
        "lagu viral indonesia 2025",
        "trending musik indonesia 2025",
        "lagu pop indonesia terbaru 2025",
        "lagu hits indonesia 2025",
        "chart musik indonesia 2025",
    ],
    poprock: [
        "oasis",
        "green day",
        "coldplay",
        "maroon 5",
        "onerepublic",
        "imagine dragons",
        "the script",
        "fall out boy",
        "panic at the disco",
        "paramore",
    ],
};

const genreNames = {
    poppunk: "Pop Punk Indo",
    indo: "Indonesia",
    poprock: "Pop Rock",
};

const genreChoices = Object.keys(genreQueries).map((g) => ({
    name: genreNames[g] || g.charAt(0).toUpperCase() + g.slice(1),
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

            // Filter tracks: max 10 minutes (600000ms) to avoid compilations/mixes
            const maxDuration = 600000; // 10 minutes
            const filteredTracks = result.tracks.filter(
                (t) => t.length && t.length < maxDuration
            );

            if (!filteredTracks.length) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("Tidak bisa menemukan lagu yang sesuai.");
                return interaction.editReply({ embeds: [embed] });
            }

            // Pick random tracks from filtered results
            const availableTracks = filteredTracks.slice(0, 20);
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
