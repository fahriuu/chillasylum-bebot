const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
} = require("discord.js");
const { createCanvas } = require("canvas");

function getCompatibility(member1, member2) {
    const data1 =
        member1.user.username.length + (member1.roles.cache.size || 0);
    const data2 =
        member2.user.username.length + (member2.roles.cache.size || 0);
    const seed = (data1 + data2) * 12345;
    const random = Math.sin(seed) * 10000;
    return Math.floor((random - Math.floor(random)) * 100) + 1;
}

function getShipMessage(percentage) {
    if (percentage >= 90) return "Jir gacor takdir inimah, JODOH DARI OROK!";
    if (percentage >= 70) return "Udah cocok, Tinggal confess aja xixi";
    if (percentage >= 50) return "Hmm notbad masih ada kesempatan";
    if (percentage >= 30) return "Kecil banget usaha lagi ya wkwk";
    if (percentage >= 10) return "Maap nt HAHAHA";
}

function createLoveMeterImage(percentage) {
    const canvas = createCanvas(400, 200);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#2b2d31";
    ctx.fillRect(0, 0, 400, 200);

    // Draw meter arc background
    const centerX = 200;
    const centerY = 150;
    const radius = 100;

    // Background arc (grey)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 0, false);
    ctx.lineWidth = 20;
    ctx.strokeStyle = "#4a4a4a";
    ctx.stroke();

    // Gradient for meter
    const gradient = ctx.createLinearGradient(100, 0, 300, 0);
    gradient.addColorStop(0, "#ffcccb");
    gradient.addColorStop(0.5, "#ff6b6b");
    gradient.addColorStop(1, "#e63946");

    // Filled arc based on percentage
    const endAngle = Math.PI + (Math.PI * percentage) / 100;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle, false);
    ctx.lineWidth = 20;
    ctx.strokeStyle = gradient;
    ctx.lineCap = "round";
    ctx.stroke();

    // Draw needle
    const needleAngle = Math.PI + (Math.PI * percentage) / 100;
    const needleLength = 70;
    const needleX = centerX + Math.cos(needleAngle) * needleLength;
    const needleY = centerY + Math.sin(needleAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(needleX, needleY);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.lineCap = "round";
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Percentage text
    ctx.font = "bold 32px Arial";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`${percentage}%`, centerX, centerY + 50);

    // Title
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#e63946";
    ctx.fillText("LOVE METER", centerX, 35);

    // Hearts on sides
    ctx.font = "30px Arial";
    ctx.fillText("💔", 50, 130);
    ctx.fillText("❤️", 350, 130);

    return canvas.toBuffer("image/png");
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ship")
        .setDescription("Cek compatibility antara 2 member")
        .addUserOption((option) =>
            option
                .setName("user1")
                .setDescription("Member pertama")
                .setRequired(true)
        )
        .addUserOption((option) =>
            option
                .setName("user2")
                .setDescription("Member kedua")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guild = interaction.guild;
            const user1Id = interaction.options.getUser("user1").id;
            const user2Id = interaction.options.getUser("user2").id;

            const member1 = await guild.members
                .fetch(user1Id)
                .catch(() => null);
            const member2 = await guild.members
                .fetch(user2Id)
                .catch(() => null);

            if (!member1 || !member2) {
                return await interaction.editReply({
                    content: "User tidak ditemukan di server ini.",
                });
            }

            if (user1Id === user2Id) {
                return await interaction.editReply({
                    content: "Pilih 2 user yang berbeda.",
                });
            }

            const compatibility = getCompatibility(member1, member2);
            const message = getShipMessage(compatibility);
            const imageBuffer = createLoveMeterImage(compatibility);

            const attachment = new AttachmentBuilder(imageBuffer, {
                name: "lovemeter.png",
            });

            let color = "#2b2d31";
            if (compatibility >= 70) color = "#ed4245";
            else if (compatibility >= 50) color = "#fee75c";
            else if (compatibility >= 30) color = "#5865f2";

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle("Love Meter 💕")
                .addFields(
                    {
                        name: "Match",
                        value: `${member1.displayName} 💖 ${member2.displayName}`,
                        inline: false,
                    },
                    {
                        name: "Result",
                        value: message,
                        inline: false,
                    }
                )
                .setImage("attachment://lovemeter.png")
                .setFooter({
                    text: `Requested by ${interaction.user.username}`,
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                files: [attachment],
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: "Terjadi error saat memproses command.",
            });
        }
    },
};
