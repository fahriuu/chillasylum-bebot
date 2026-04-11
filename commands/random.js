const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

// Random search queries per genre (latest 2025)
const genreQueries = {
    pop: [
        "Taylor Swift latest hits",
        "Billie Eilish new songs",
        "Sabrina Carpenter trending",
        "Dua Lipa top tracks",
        "Ariana Grande music",
    ],
    rock: [
        "Foo Fighters latest",
        "Arctic Monkeys popular",
        "Bring Me The Horizon new",
        "Royal Blood tracks",
        "Muse best songs",
    ],
    hiphop: [
        "Kendrick Lamar latest",
        "Drake new release",
        "Travis Scott top hits",
        "Central Cee trending",
        "Playboi Carti music",
    ],
    edm: [
        "Fred again.. new tracks",
        "Peggy Gou trending",
        "Martin Garrix latest",
        "Skrillex recent music",
        "Dom Dolla hits",
    ],
    jazz: [
        "Laufey jazz songs",
        "Jon Batiste latest",
        "Kamasi Washington",
        "Snarky Puppy popular",
        "Jacob Collier music",
    ],
    kpop: [
        "NewJeans latest hits",
        "IVE trending songs",
        "Le Sserafim new release",
        "Stray Kids top tracks",
        "BABYMONSTER music",
    ],
    metal: [
        "Sleep Token latest",
        "Bad Omens popular",
        "Spiritbox new songs",
        "Architects tracks",
        "Knocked Loose music",
    ],
    acoustic: [
        "Ed Sheeran acoustic",
        "Noah Kahan trending",
        "Boygenius acoustic hits",
        "Gracie Abrams music",
    ],
    classical: [
        "Ludovico Einaudi latest",
        "Max Richter contemporary",
        "Hania Rani piano",
        "Joep Beving tracks",
    ],
    indie: [
        "Mitski popular songs",
        "The Strokes latest",
        "Beabadoobee trending",
        "Wallows new tracks",
        "Tame Impala music",
    ],
    rnb: [
        "SZA latest hits",
        "Daniel Caesar popular",
        "Tems new songs",
        "Victoria Monét tracks",
        "Brent Faiyaz music",
    ],
    lofi: [
        "Lofi Girl best beats",
        "ChilledCow playlist",
        "Nujabes style lofi",
        "Idealism lofi tracks",
    ],
    poppunk: [
        "Pee Wee Gaskins terbaru",
        "Stand Here Alone hits",
        "For Revenge terbaru",
        "Blink-182 new songs",
        "Machine Gun Kelly pop punk",
        "The Story So Far",
    ],
    indo: [
        "Hindia lagu terbaru",
        "Bernadya trending",
        "Sal Priadi hits",
        "Nadin Amizah music",
        "Tulus popular tracks",
        "Juicy Luicy terbaru",
        "indahkus malu-malu boy"
    ],
    poprock: [
        "Oasis reunion tracks",
        "Coldplay latest",
        "Imagine Dragons new",
        "The 1975 popular",
        "Linkin Park new era",
        "Paramore best hits",
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
