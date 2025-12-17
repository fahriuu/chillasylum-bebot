const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");
const {
    getAuthUrl,
    isUserConnected,
    disconnectUser,
} = require("../utils/spotifyAuth");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("spotify")
        .setDescription("Manage Spotify connection")
        .addSubcommand((sub) =>
            sub
                .setName("connect")
                .setDescription("Connect your Spotify account")
        )
        .addSubcommand((sub) =>
            sub
                .setName("disconnect")
                .setDescription("Disconnect your Spotify account")
        )
        .addSubcommand((sub) =>
            sub
                .setName("status")
                .setDescription("Check Spotify connection status")
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "connect") {
            if (isUserConnected(interaction.user.id)) {
                const embed = new EmbedBuilder()
                    .setColor("#1DB954")
                    .setDescription(
                        "✅ Spotify kamu sudah terkoneksi! Gunakan `/spotify disconnect` untuk disconnect."
                    );
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const authUrl = getAuthUrl(interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setTitle("🎵 Connect Spotify")
                .setDescription(
                    "Klik tombol di bawah untuk menghubungkan akun Spotify kamu.\n\nIni akan memberikan akses ke:\n• Liked Songs\n• Private Playlists\n• Top Tracks"
                )
                .setFooter({ text: "Link akan expire dalam 5 menit" });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("Connect Spotify")
                    .setStyle(ButtonStyle.Link)
                    .setURL(authUrl)
                    .setEmoji("🔗")
            );

            return interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        }

        if (subcommand === "disconnect") {
            if (!isUserConnected(interaction.user.id)) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setDescription("❌ Spotify kamu belum terkoneksi.");
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            disconnectUser(interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor("#1DB954")
                .setDescription("✅ Spotify berhasil di-disconnect.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (subcommand === "status") {
            const connected = isUserConnected(interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor(connected ? "#1DB954" : "#ed4245")
                .setTitle("Spotify Status")
                .setDescription(
                    connected
                        ? "✅ Spotify terkoneksi"
                        : "❌ Spotify belum terkoneksi\n\nGunakan `/spotify connect` untuk menghubungkan."
                );

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },
};
