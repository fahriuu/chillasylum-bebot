const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stop")
        .setDescription("Stop musik dan clear queue"),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Kamu harus join voice channel dulu!");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Bot tidak sedang memutar musik.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Check if user is in the same voice channel as bot
        if (player.voiceId !== voiceChannel.id) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Kamu harus join <#${player.voiceId}> untuk control musik.`
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            // Stop playing and clear queue, but keep bot in voice channel
            player.queue.clear();
            player.stopTrack();
        } catch (e) {
            console.error("Stop error:", e);
        }

        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setDescription("⏹️ Musik dihentikan dan queue di-clear.");
        return interaction.reply({ embeds: [embed] });
    },
};
