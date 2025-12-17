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

        const skipped = player.queue.current;
        player.skip();

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setDescription(`⏭️ Skipped **${skipped.title}**`);
        return interaction.reply({ embeds: [embed] });
    },
};
