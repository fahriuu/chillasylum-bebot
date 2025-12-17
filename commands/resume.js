const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("resume")
        .setDescription("Lanjutkan lagu yang di-pause"),

    async execute(interaction) {
        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Tidak ada lagu yang sedang diputar.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!player.paused) {
            const embed = new EmbedBuilder()
                .setColor("#fee75c")
                .setDescription("Lagu tidak sedang di-pause.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        player.pause(false);

        const embed = new EmbedBuilder()
            .setColor("#1DB954")
            .setDescription("▶️ Lagu dilanjutkan.");
        return interaction.reply({ embeds: [embed] });
    },
};
