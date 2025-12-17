const { Kazagumo, Plugins } = require("kazagumo");
const { Shoukaku, Connectors } = require("shoukaku");

// Public Lavalink nodes (gratis)
const nodes = [
    {
        name: "Lavalink",
        url: "lavalink.jirayu.net:13592",
        auth: "youshallnotpass",
        secure: false,
    },
];

let kazagumo = null;

function initLavalink(client) {
    kazagumo = new Kazagumo(
        {
            defaultSearchEngine: "youtube",
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            },
        },
        new Connectors.DiscordJS(client),
        nodes,
        {
            moveOnDisconnect: false,
            resumable: false,
            resumableTimeout: 30,
            reconnectTries: 3,
            restTimeout: 60000,
        }
    );

    kazagumo.shoukaku.on("ready", (name) => {
        console.log(`✅ Lavalink node "${name}" connected`);
    });

    kazagumo.shoukaku.on("error", (name, error) => {
        console.error(`❌ Lavalink node "${name}" error:`, error);
    });

    kazagumo.shoukaku.on("close", (name, code, reason) => {
        console.log(`⚠️ Lavalink node "${name}" closed: ${code} - ${reason}`);
    });

    kazagumo.on("playerStart", (player, track) => {
        console.log(`Playing: ${track.title}`);
    });

    kazagumo.on("playerEnd", (player) => {
        if (!player.queue.length) {
            player.data.get("textChannel")?.send({
                embeds: [
                    {
                        color: 0x5865f2,
                        description: "Queue finished. Leaving voice channel...",
                    },
                ],
            });
        }
    });

    kazagumo.on("playerEmpty", (player) => {
        setTimeout(() => {
            if (!player.queue.length && !player.playing) {
                player.destroy();
            }
        }, 300000); // 5 menit
    });

    return kazagumo;
}

function getKazagumo() {
    return kazagumo;
}

module.exports = { initLavalink, getKazagumo };
