const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop musik dan clear queue"),

    async execute(interaction) {
        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Bot tidak sedang memutar musik.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const currentTrack = player.queue.current;

        // Check if user is the requester
        if (
            currentTrack &&
            currentTrack.requester?.id !== interaction.user.id
        ) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Hanya <@${currentTrack.requester?.id}> yang bisa stop musik.`
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        player.destroy();

        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setDescription(" Musik dihentikan dan queue di-clear.");
        return interaction.reply({ embeds: [embed] });
    },
};
