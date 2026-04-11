const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("stay")
        .setDescription("Bot akan stay di voice channel dan tidak auto-leave"),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Kamu harus join voice channel dulu!");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const kazagumo = getKazagumo();
        if (!kazagumo) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Music system belum siap.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        let player = kazagumo.players.get(interaction.guild.id);

        // Create player if not exists
        if (!player) {
            player = await kazagumo.createPlayer({
                guildId: interaction.guild.id,
                textId: interaction.channel.id,
                voiceId: voiceChannel.id,
                volume: 100,
                deaf: true,
            });
            player.data.set("textChannel", interaction.channel);
        }

        // Check if user in same VC
        if (player.voiceId !== voiceChannel.id) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(`Bot sedang di <#${player.voiceId}>.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Set stay mode
        player.data.set("stayMode", true);

        // Clear any existing disconnect timeout
        const timeoutId = player.data.get("disconnectTimeout");
        if (timeoutId) {
            clearTimeout(timeoutId);
            player.data.delete("disconnectTimeout");
        }

        const embed = new EmbedBuilder()
            .setColor("#57F287")
            .setDescription(
                "Bot akan stay di voice channel dan tidak auto-leave.",
            );

        return interaction.reply({ embeds: [embed] });
    },
};
