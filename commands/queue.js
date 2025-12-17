const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getKazagumo } = require("../utils/lavalink");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("queue")
        .setDescription("Lihat daftar antrian lagu"),

    async execute(interaction) {
        const kazagumo = getKazagumo();
        const player = kazagumo?.players.get(interaction.guild.id);

        if (!player || !player.queue.current) {
            const embed = new EmbedBuilder()
                .setColor("#2b2d31")
                .setDescription("Queue kosong.");
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const current = player.queue.current;
        const upcoming = player.queue.slice(0, 10);

        let description = `**Now Playing:**\n[${current.title}](${
            current.uri
        }) - ${formatDuration(current.length)}\n\n`;

        if (upcoming.length > 0) {
            description += "**Up Next:**\n";
            upcoming.forEach((track, index) => {
                description += `\`${index + 1}.\` ${
                    track.title
                } - ${formatDuration(track.length)}\n`;
            });
        }

        if (player.queue.length > 10) {
            description += `\n...dan ${player.queue.length - 10} lagu lainnya`;
        }

        const embed = new EmbedBuilder()
            .setColor("#1DB954")
            .setTitle("Music Queue")
            .setDescription(description)
            .setThumbnail(current.thumbnail)
            .setFooter({ text: `Total: ${player.queue.length + 1} lagu` });

        return interaction.reply({ embeds: [embed] });
    },
};

function formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
