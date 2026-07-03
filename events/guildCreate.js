const deployCommands = require("../utils/deployCommands");

module.exports = {
    name: "guildCreate",
    once: false,
    async execute(guild) {
        console.log(`\n📥 Bot baru saja join server: ${guild.name} (ID: ${guild.id})`);
        console.log(`📊 Total server sekarang: ${guild.client.guilds.cache.size}`);

        try {
            // Fetch semua member di guild baru (opsional, tapi bagus untuk sinkronisasi)
            await guild.members.fetch();
            console.log(`Fetched ${guild.memberCount} members dari ${guild.name}`);
        } catch (err) {
            console.error(`Gagal fetch members dari ${guild.name}:`, err.message);
        }

        // Deploy slash commands khusus untuk guild baru ini
        await deployCommands(guild.client, guild.id);
    },
};
