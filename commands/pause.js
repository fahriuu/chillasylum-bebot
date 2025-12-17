const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("pause")
        .setDescription("Pause lagu yang sedang diputar"),

    async execute(interaction) {
        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Tidak ada lagu yang sedang diputar.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const currentTrack = player.queue.current;

        // Check if user is the requester
        if (currentTrack.requester?.id !== interaction.user.id) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Hanya <@${currentTrack.requester?.id}> yang bisa pause lagu ini.`
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (player.paused) {
            const embed = new EmbedBuilder()
                .setColor("#fee75c")
                .setDescription("Lagu sudah di-pause.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        player.pause(true);

        const embed = new EmbedBuilder()
            .setColor("#fee75c")
            .setDescription("⏸️ Lagu di-pause.");
        return interaction.reply({ embeds: [embed] });
    },
};
