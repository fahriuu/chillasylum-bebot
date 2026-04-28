module.exports = {
    name: "interactionCreate",
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(
            interaction.commandName
        );

        if (!command) {
            console.error(
                `Command tidak ditemukan: ${interaction.commandName}`
            );
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            // Abaikan error interaksi yang sudah expired/dibalas
            if (error?.code === 40060 || error?.code === 10062) return;

            console.error(error);
            const errorReply = {
                content: "❌ Ada error saat menjalankan command!",
                flags: 64, // ephemeral flag
            };

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorReply);
                } else {
                    await interaction.reply(errorReply);
                }
            } catch (replyError) {
                // Abaikan error 40060 saat fallback reply
                if (replyError?.code === 40060) return;
                console.error("Error saat send error message:", replyError);
            }
        }
    },
};
