require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, IntentsBitField, Collection, EmbedBuilder } = require("discord.js");
const { initLavalink } = require("./utils/lavalink");
const { askQwen } = require("./utils/ai");
const { Api: TopggApi } = require("@top-gg/sdk");

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildModeration,
    ],
});

// Collections untuk commands
client.commands = new Collection();
client.prefixCommands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    // Slash commands
    if ("data" in command && "execute" in command && !command.prefix) {
        client.commands.set(command.data.name, command);
    }
    // Prefix commands
    else if (command.prefix && "name" in command && "execute" in command) {
        client.prefixCommands.set(command.name, command);
        console.log(`✅ Prefix Command loaded: !${command.name}`);
    }
}

// Load events
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Bad words filter (kata kasar Indonesia + English)
const badWords = [
    "anjing",
    "anjg",
    "anjir",
    "ajg",
    "anj",
    "bangsat",
    "bgst",
    "bngst",
    "kontol",
    "kntl",
    "memek",
    "mmk",
    "goblok",
    "goblog",
    "gblk",
    "tolol",
    "tll",
    "bego",
    "bodoh",
    "idiot",
    "tai",
    "taik",
    "tahi",
    "kampret",
    "kmprt",
    "bajingan",
    "bjngn",
    "setan",
    "iblis",
    "babi",
    "monyet",
    "pepek",
    "ngentot",
    "ngewe",
    "asu",
    "jancok",
    "jancuk",
    "cok",
    "bacot",
    "bcot",
    "bacod",
    "fuck",
    "fak",
    "fck",
    "fuk",
    "shit",
    "bitch",
    "ass",
    "bangke",
    "bgke",
];

// Handle messages
client.on("messageCreate", (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    // Anti-scam / phishing filter (HIGH ACCURACY PARAMS)
    const phishingLinks = [
        "disord.gift", "discordc.gift", "dlscord.gift", "discord-nitro", 
        "steamcommunity-", "steancommunity", "robux-free", "free-nitro"
    ];
    
    const scamPhrases = [
        "free nitro", "discord nitro gratis", "crypto casino", "withdrawal success", 
        "activate code", "claim your reward", "airdrop", "bisa dapat nitro"
    ];

    // 1. Deteksi Pasti Scam (Direct Hit)
    const isDirectScam = phishingLinks.some(link => content.includes(link)) || 
                         scamPhrases.some(phrase => content.includes(phrase));

    // 2. Sistem Parameter Kata Kunci (Regex Word Boundary \b agar sangat akurat)
    // Contoh: \bwin\b hanya mendeteksi "win" utuh, jadi kata "window" tidak akan dideteksi.
const suspiciousKeywords = [
    { word: /\bcrypto\b/, weight: 1 },
    { word: /\busdt\b/, weight: 1 },
    { word: /\bmr\s*beast\b/, weight: 2 },
    { word: /\bcasino\b/, weight: 1 },
    { word: /\bgiveaway\b/, weight: 1 },
    { word: /\bclaim\b/, weight: 1 },
    { word: /\bbonus\b/, weight: 1 },
    { word: /\bfree\b/, weight: 1 },
    { word: /\bwin\b/, weight: 1 },
    { word: /\breward\b/, weight: 1 },
    { word: /\bwallet\b/, weight: 1 }
];

    let wordScore = 0;
    suspiciousKeywords.forEach(item => {
        if (item.word.test(content)) {
            wordScore += item.weight;
        }
    });

    const hasLink = content.includes("http://") || content.includes("https://") || content.includes("discord.gg/");
    const hasMassMention = content.includes("@everyone") || content.includes("@here");

    let isSusScam = false;

    // Rules Eksekusi untuk Kecurigaan (Scoring Logic):
    // Jika kata-katanya sangat memancing (score >= 3)
    if (wordScore >= 3) isSusScam = true;
    // Jika score >= 2 DAN ada Link HTTP di pesannya
    else if (wordScore >= 2 && hasLink) isSusScam = true;
    // Jika score >= 1 DAN ada Link DAN mentag @everyone (Sangat tipikal Scam)
    else if (wordScore >= 1 && hasLink && hasMassMention) isSusScam = true;

    // Eksekusi Penghapusan
    if (isDirectScam || isSusScam) {
        message.delete().catch(err => console.error("Gagal hapus pesan scam:", err));
        message.channel.send(`🚫 <@${message.author.id}>, pesan kamu dihapus karena terdeteksi sebagai indikasi **Scam/Phishing/Spam**!`).then(msg => {
            setTimeout(() => msg.delete().catch(() => {}), 7000); // Hapus peringatan setelah 7 detik
        });

        // Log ke channel logs/mod-logs
        if (message.guild) {
            const logChannel = message.guild.channels.cache.find(c => 
                c.name === "mod-logs" || c.name === "logs" || c.name === "server-logs"
            );
            if (logChannel) {
                let msgContent = message.content || "[Hanya Attachment/Embed]";
                if (msgContent.length > 1024) msgContent = msgContent.substring(0, 1021) + "...";

                const embed = new EmbedBuilder()
                    .setTitle("🚨 Scam/Spam Terdeteksi & Dihapus")
                    .setColor("#FF0000")
                    .addFields(
                        { name: "Pelaku", value: `${message.author} (${message.author.tag})`, inline: true },
                        { name: "Lokasi (Channel)", value: `${message.channel}`, inline: true },
                        { name: "Isi Pesan", value: msgContent }
                    )
                    .setTimestamp();
                
                logChannel.send({ embeds: [embed] }).catch(console.error);
            }
        }

        return;
    }

    // Check for bad words (any message)
    // Gunakan word boundary agar tidak salah deteksi kata normal (misal "panjang" kena "anj")
    const words = content.replace(/[^\w\s]/g, '').split(/\s+/);
    const hasBadWord = words.some((word) => badWords.includes(word));
    if (hasBadWord) {
        const warnings = [
            `Hei <@${message.author.id}>, tolong jaga omonganmu ya memek`,
            `<@${message.author.id}> Ehh, mulutnya kaya ga di sekolahin`,
            `<@${message.author.id}> pepek so a6 lo kontol`,
            `Sabar <@${message.author.id}>, dek `,
            `<@${message.author.id}> so cakep lu kodok`,
        ];
        const randomWarning =
            warnings[Math.floor(Math.random() * warnings.length)];
        message.reply(randomWarning);
        return;
    }

    // pertanyaan siapa owner atau yang punya server
    const hasOwner = words.some((word) => word === "owner") || content.includes("yang punya");
    if (hasOwner) {
        if (message.guild) {
            message.reply(`Owner server (Discord) ini adalah King <@${message.guild.ownerId}> 👑`);
        } else {
            message.reply("Owner nya afk jir menghilang wkwkwk");
        }
        return;
    }


    // Respon halo
    const haloKeywords = ["halo", "hai", "hello", "hi", "hey"];
    if (haloKeywords.some((word) => content.includes(word))) {
        message.reply(`👋 Halo <@${message.author.id}>!`);
        return;
    }

    // AI Chat respon jika bot di-tag
    if (message.mentions.has(client.user) && !message.mentions.everyone) {
        const question = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        if (question.length > 0) {
            message.channel.sendTyping();
            askQwen(question).then(replyText => {
                message.reply(replyText);
            });
            return;
        }
    }

    // Handle prefix commands
    const prefix = "!";
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
        command.execute(message, args);
    } catch (error) {
        console.error(error);
        message.reply({
            content: "❌ Ada error saat menjalankan command!",
        });
    }
});

// Handle error
client.on("error", (error) => {
    console.error("Client error:", error.message);
});

process.on("unhandledRejection", (reason) => {
    // Gracefully handle Lavalink rate limit (429) errors
    if (reason && (reason.status === 429 || reason.code === 429)) {
        console.warn(
            `⚠️ Lavalink rate limited (429) on ${reason.path || "unknown path"} — suppressed to prevent crash`,
        );
        return;
    }

    // Gracefully handle other Lavalink REST errors (e.g. node temporarily unavailable)
    if (
        reason &&
        reason.constructor?.name === "RestError" &&
        reason.status >= 400
    ) {
        console.warn(
            `⚠️ Lavalink REST error (${reason.status}) on ${reason.path || "unknown path"}: ${reason.error || reason.message}`,
        );
        return;
    }

    console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error.message);
});

// Graceful shutdown
process.on("SIGINT", () => {
    client.destroy();
    process.exit(0);
});

process.on("SIGTERM", () => {
    client.destroy();
    process.exit(0);
});

// Init Lavalink
initLavalink(client);

// Init Top.gg stat posting (if token provided)
if (process.env.TOPGG_TOKEN) {
    const topgg = new TopggApi(process.env.TOPGG_TOKEN);

    const postTopggStats = async () => {
        try {
            await topgg.postStats({
                serverCount: client.guilds.cache.size,
            });
            console.log(`✅ Top.gg stats posted: ${client.guilds.cache.size} servers`);
        } catch (error) {
            console.error("❌ Top.gg post stats error:", error.message);
        }
    };

    // Post stats once bot is ready, then every 30 minutes
    client.once("clientReady", () => {
        postTopggStats();
        setInterval(postTopggStats, 30 * 60 * 1000);
        console.log("🔝 Top.gg stat poster initialized");
    });
} else {
    console.log("⚠️ Top.gg token not found - stats posting disabled");
}

// Login bot
client.login(process.env.DISCORD_TOKEN);
