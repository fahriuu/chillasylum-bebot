const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip lagu yang sedang diputar"),

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
                    `Hanya <@${currentTrack.requester?.id}> yang bisa skip lagu ini.`
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const skipped = currentTrack;
        const nextTrack = player.queue[0];

        player.skip();

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setDescription(` Skipped **${skipped.title}**`);

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
