const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
} = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip lagu yang sedang diputar"),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Kamu harus join voice channel dulu!");
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }

        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription("Tidak ada lagu yang sedang diputar.");
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }

        // Check if user is in the same voice channel as bot
        if (player.voiceId !== voiceChannel.id) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setDescription(
                    `Kamu harus join <#${player.voiceId}> untuk control musik.`
                );
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral,
            });
        }

        const skippedTrack = player.queue.current;
        const nextTrack = player.queue[0];

        try {
            player.skip();
        } catch (e) {
            console.error("Skip error:", e);
        }

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setDescription(
                ` Skipped **${skippedTrack?.title || "Unknown"}**`
            );

        if (nextTrack) {
            embed.addFields({
                name: "Now Playing",
                value: `**${nextTrack.title}** - ${
                    nextTrack.author || "Unknown"
                }`,
            });
        } else {
            embed.addFields({
                name: "Queue",
                value: "No more songs in queue",
            });
        }

        return interaction.reply({ embeds: [embed] });
    },
};
